// Library scanner — walks a folder for MIDI files and extracts header-level
// facts (tempo, time signature, length). The feel/kick classifier is the
// next milestone and will live here too. No Electron dependencies.
const path = require('path');
const fs = require('fs');
const { parseMidi } = require('midi-file');

// First tempo/timesig wins; bars measured to the last note ATTACK then
// ceiled — validated 396/397 against the prototype catalog as ground truth
// (one odd-meter fill disagrees).
function analyze(file) {
  const parsed = parseMidi(fs.readFileSync(file));
  let bpm = null, num = null, den = null, lastOn = 0;
  for (const track of parsed.tracks) {
    let t = 0;
    for (const ev of track) {
      t += ev.deltaTime;
      if (ev.type === 'setTempo' && bpm == null) bpm = Math.round(60e6 / ev.microsecondsPerBeat);
      if (ev.type === 'timeSignature' && num == null) { num = ev.numerator; den = ev.denominator; }
      if (ev.type === 'noteOn' && ev.velocity > 0 && t > lastOn) lastOn = t;
    }
  }
  num = num ?? 4; den = den ?? 4;
  const tpb = parsed.header.ticksPerBeat || 480;
  const bars = Math.max(1, Math.ceil((lastOn + 1) / (tpb * num * (4 / den))));
  return { bpm, ts: `${num}/${den}`, bars };
}

// Full note extraction for preview playback: absolute-tick note attacks plus
// the same header facts analyze() reports.
function readNotes(file) {
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
  return { tpb, bpm, barTicks, bars, notes };
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
    try { info = analyze(p); } catch { /* unreadable MIDI — keep it listed anyway */ }
    out.push({
      pack: rel.length > 1 ? clean(rel[0]) : clean(path.basename(root)),
      section: rel.slice(1, -1).map(clean).join(' / '),
      file: rel[rel.length - 1],
      path: p,
      cat: /fill/i.test(rel[rel.length - 1]) ? 'fill' : 'groove',
      feel: null, time: null, kick: '', hits: null, toms: null, // classifier: milestone 2
      ...info,
    });
    if (i % 200 === 0) await onProgress(`Analyzing… ${i.toLocaleString()} / ${files.length.toLocaleString()}`);
  }
  return out;
}

module.exports = { analyze, scan, readNotes };
