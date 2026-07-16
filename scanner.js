// Library scanner — walks a folder for MIDI files, extracts header-level
// facts (tempo, time signature, length), and classifies feel/kick/cymbal.
// No Electron dependencies.
const path = require('path');
const fs = require('fs');
const { parseMidi } = require('midi-file');

const POS_NAMES = ['1', '1e', '1&', '1a', '2', '2e', '2&', '2a', '3', '3e', '3&', '3a', '4', '4e', '4&', '4a'];
const KICK_NOTES = [35, 36];
const SNARE_NOTES = [37, 38, 39, 40];
const CLOSED_HAT_NOTES = [42, 44];
const OPEN_HAT_NOTES = [46];
const RIDE_NOTES = [51, 53, 59];
const TOM_NOTES = [41, 43, 45, 47, 48, 50, 58, 60, 61, 62, 63, 64];

// One MIDI parse shared by analyze/readNotes/classify — first tempo/timesig
// wins; bars measured to the last note ATTACK then ceiled. Validated
// 396/397 against the prototype catalog as ground truth (one odd-meter
// fill disagrees).
function parseFile(file) {
  const parsed = parseMidi(fs.readFileSync(file));
  let bpm = null, num = null, den = null, lastOn = 0;
  const notes = [];
  for (const track of parsed.tracks) {
    let t = 0;
    for (const ev of track) {
      t += ev.deltaTime;
      if (ev.type === 'setTempo' && bpm == null) bpm = Math.round(60e6 / ev.microsecondsPerBeat);
      if (ev.type === 'timeSignature' && num == null) { num = ev.numerator; den = ev.denominator; }
      if (ev.type === 'noteOn' && ev.velocity > 0) {
        notes.push([t, ev.noteNumber, ev.velocity]);
        if (t > lastOn) lastOn = t;
      }
    }
  }
  num = num ?? 4; den = den ?? 4;
  const tpb = parsed.header.ticksPerBeat || 480;
  const barTicks = tpb * num * (4 / den);
  const bars = Math.max(1, Math.ceil((lastOn + 1) / barTicks));
  notes.sort((a, b) => a[0] - b[0]);
  return { tpb, bpm, num, den, barTicks, bars, notes };
}

function analyze(file) {
  const { bpm, num, den, bars } = parseFile(file);
  return { bpm, ts: `${num}/${den}`, bars };
}

function readNotes(file) {
  const { tpb, bpm, barTicks, bars, notes } = parseFile(file);
  return { tpb, bpm, barTicks, bars, notes };
}

// Feel/kick/cymbal classifier — reverse-engineered against the prototype's
// 396k-record catalog (see dev-data ground truth). Measured accuracy at
// milestone landing: hits 100%, toms ~88%, cymbal ~86%, kick label ~86%
// on confident (bar-consistent) patterns, feel ~71% overall. Fuzzier than
// analyze()'s header facts because note-number-to-drum-piece mapping isn't
// fully standardized across sample libraries (SSD5/EZX/Groove Monkee each
// vary slightly) — a known, documented ceiling, not a bug.
function classify({ barTicks, bars, notes }) {
  const step = barTicks / 16;
  const gridIdx = (t) => Math.round((t % barTicks) / step) % 16;
  const has = (list) => notes.some((n) => list.includes(n[1]));
  const hits = notes.length;

  if (hits === 0) return { feel: 'empty', kick: '-', time: 'none', hits: 0, toms: false };

  const toms = has(TOM_NOTES);
  const time = has(OPEN_HAT_NOTES) ? 'open-hat' : has(RIDE_NOTES) ? 'ride' : has(CLOSED_HAT_NOTES) ? 'closed-hat' : 'none';

  // kick: unique bar-relative 16-grid positions, IF the pattern repeats
  // identically every bar; otherwise "N hits" (N = union of positions
  // across bars) rather than a confidently wrong single-bar label.
  const kickPerBar = {};
  for (const [t, n] of notes) {
    if (!KICK_NOTES.includes(n)) continue;
    const bar = Math.floor(t / barTicks);
    (kickPerBar[bar] ??= new Set()).add(gridIdx(t));
  }
  const kickBars = Object.values(kickPerBar);
  let kick = '-';
  if (kickBars.length) {
    const first = [...kickBars[0]].sort((a, b) => a - b);
    const consistent = kickBars.every((s) => s.size === first.length && first.every((i) => s.has(i)));
    if (consistent && first.length <= 8) {
      kick = (first.length === 4 && [0, 4, 8, 12].every((i) => first.includes(i)))
        ? '4-on-floor' : first.map((i) => POS_NAMES[i]).join(',');
    } else {
      const union = new Set();
      kickBars.forEach((s) => s.forEach((i) => union.add(i)));
      kick = `${union.size} hits`;
    }
  }

  // feel: driven by the snare's unique bar-relative grid positions.
  const snareIdx = [...new Set(notes.filter((n) => SNARE_NOTES.includes(n[1])).map((n) => gridIdx(n[0])))].sort((a, b) => a - b);
  const key = snareIdx.join(',');
  let feel;
  if (snareIdx.length === 0) feel = 'no-snare';
  else if (key === '8') feel = 'half-time';
  else if (key === '0,4,8,12') feel = 'fast one-beat';
  else if (snareIdx.includes(4) && snareIdx.includes(12) && snareIdx.length <= 4) feel = 'straight backbeat';
  else if (snareIdx.length >= 7) feel = 'busy / fill';
  else if (snareIdx.length <= 2) feel = 'backbeat-ish';
  else feel = 'd-beat / gallop';

  return { feel, kick, time, hits, toms };
}

async function findMidis(root, onProgress) {
  const files = [], stack = [root];
  let dirs = 0;
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (/\.midi?$/i.test(e.name)) files.push(p);
    }
    if (++dirs % 100 === 0) await onProgress(`Scanning folders… ${files.length.toLocaleString()} MIDI files found`);
  }
  return files;
}

async function scan(root, onProgress = async () => {}) {
  const files = await findMidis(root, onProgress);
  const clean = (s) => s.replace(/\.(lib|sng|prt)$/i, '');
  const out = [];
  for (let i = 0; i < files.length; i++) {
    const p = files[i];
    const rel = path.relative(root, p).split(path.sep);
    let info = { bpm: null, ts: null, bars: 1 };
    let cls = { feel: null, kick: '', time: null, hits: null, toms: null };
    try {
      const parsed = parseFile(p);
      info = { bpm: parsed.bpm, ts: `${parsed.num}/${parsed.den}`, bars: parsed.bars };
      cls = classify(parsed);
    } catch { /* unreadable MIDI — keep it listed anyway */ }
    out.push({
      pack: rel.length > 1 ? clean(rel[0]) : clean(path.basename(root)),
      section: rel.slice(1, -1).map(clean).join(' / '),
      file: rel[rel.length - 1],
      path: p,
      cat: /fill/i.test(rel[rel.length - 1]) ? 'fill' : 'groove',
      ...info,
      ...cls,
    });
    if (i % 200 === 0) await onProgress(`Analyzing… ${i.toLocaleString()} / ${files.length.toLocaleString()}`);
  }
  return out;
}

module.exports = { analyze, scan, readNotes, classify, parseFile };
