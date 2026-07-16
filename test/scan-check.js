// Smallest runnable check for the scanner. Two tiers:
//  1. Always: analyze() a synthetic MIDI byte-for-byte fixture built in-memory.
//  2. If the dev ground-truth catalog + library volume are present: sample it
//     and require ≥99% exact (bpm, ts, bars) agreement.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { writeMidi } = require('midi-file');
const { analyze, scan, readNotes, classify, parseFile } = require('../scanner');

// --- tier 1: synthetic fixture ---------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-test-'));
const mid = writeMidi({
  header: { format: 0, numTracks: 1, ticksPerBeat: 480 },
  tracks: [[
    { deltaTime: 0, meta: true, type: 'setTempo', microsecondsPerBeat: 500000 }, // 120 BPM
    { deltaTime: 0, meta: true, type: 'timeSignature', numerator: 3, denominator: 4, metronome: 24, thirtyseconds: 8 },
    { deltaTime: 0, type: 'noteOn', channel: 9, noteNumber: 36, velocity: 100 },
    { deltaTime: 240, type: 'noteOff', channel: 9, noteNumber: 36, velocity: 0 },
    { deltaTime: 480 * 3 * 2 - 480, type: 'noteOn', channel: 9, noteNumber: 38, velocity: 100 }, // attack in bar 2 of 3/4
    { deltaTime: 240, type: 'noteOff', channel: 9, noteNumber: 38, velocity: 0 },
    { deltaTime: 0, meta: true, type: 'endOfTrack' },
  ]],
});
const fixture = path.join(tmp, 'Test Fill 01.mid');
fs.writeFileSync(fixture, Buffer.from(mid));

const a = analyze(fixture);
assert.deepStrictEqual(a, { bpm: 120, ts: '3/4', bars: 2 }, `analyze fixture: ${JSON.stringify(a)}`);

const n = readNotes(fixture);
assert.strictEqual(n.tpb, 480);
assert.strictEqual(n.barTicks, 480 * 3); // 3/4
assert.strictEqual(n.bars, 2);
assert.deepStrictEqual(n.notes, [[0, 36, 100], [480 * 3 * 2 - 240, 38, 100]], `readNotes: ${JSON.stringify(n.notes)}`);

// classify() is a pure function over {barTicks, bars, notes} — test it
// directly with a clean 1-bar 4/4 pattern: kick on 1 & 3, backbeat snare
// on 2 & 4, closed hi-hat on every 8th, no toms.
const step = 120; // arbitrary tick unit
const c = classify({
  barTicks: step * 16,
  bars: 1,
  notes: [
    [0 * step, 36, 120], [8 * step, 36, 120],       // kick: 1, 3
    [4 * step, 38, 100], [12 * step, 38, 100],      // snare: 2, 4 (straight backbeat)
    ...[0, 2, 4, 6, 8, 10, 12, 14].map((i) => [i * step, 42, 90]), // closed hat, 8ths
  ],
});
assert.deepStrictEqual(c, { feel: 'straight backbeat', kick: '1,3', time: 'closed-hat', hits: 12, toms: false }, `classify: ${JSON.stringify(c)}`);
assert.deepStrictEqual(classify({ barTicks: step * 16, bars: 1, notes: [] }), { feel: 'empty', kick: '-', time: 'none', hits: 0, toms: false });

// scan() derives pack/section/file from the folder structure
fs.mkdirSync(path.join(tmp, 'My Pack.lib', 'Verses.sng'), { recursive: true });
fs.copyFileSync(fixture, path.join(tmp, 'My Pack.lib', 'Verses.sng', 'Test Fill 01.mid'));
scan(tmp).then((records) => {
  const r = records.find((x) => x.section === 'Verses');
  assert.ok(r, 'scan found nested file');
  assert.strictEqual(r.pack, 'My Pack');
  assert.strictEqual(r.cat, 'fill');
  assert.strictEqual(r.bpm, 120);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('tier 1 (synthetic): PASS');

  // --- tier 2: ground truth, if available -----------------------------------
  const gt = path.join(__dirname, '..', 'dev-data', 'catalog.json.gz');
  if (!fs.existsSync(gt)) return console.log('tier 2 (ground truth): SKIPPED — no dev-data');
  const cat = JSON.parse(zlib.gunzipSync(fs.readFileSync(gt)));
  if (!fs.existsSync(cat[0].path)) return console.log('tier 2 (ground truth): SKIPPED — library volume not mounted');
  let checked = 0;
  const hit = { header: 0, hits: 0, toms: 0, time: 0, feel: 0 };
  for (let i = 0; i < cat.length; i += 1000) {
    const r = cat[i];
    if (!fs.existsSync(r.path)) continue;
    checked++;
    const parsed = parseFile(r.path);
    const g = { bpm: parsed.bpm, ts: `${parsed.num}/${parsed.den}`, bars: parsed.bars };
    const cls = classify(parsed);
    if (g.bpm === r.bpm && g.ts === r.ts && g.bars === r.bars) hit.header++;
    if (cls.hits === r.hits) hit.hits++;
    if (cls.toms === r.toms) hit.toms++;
    if (cls.time === r.time) hit.time++;
    if (cls.feel === r.feel) hit.feel++;
  }
  // Header facts (bpm/ts/bars) are exact MIDI data — near-100%. The
  // classifier is fuzzier: note-number-to-drum-piece mapping isn't fully
  // standardized across sample libraries, so these floors are the measured
  // real-world ceiling, not an aspirational target — a regression alarm,
  // not a promise of higher accuracy.
  const pct = (n) => ((n / checked) * 100).toFixed(1) + '%';
  assert.ok(hit.header / checked >= 0.99, `header agreement ${pct(hit.header)}`);
  assert.ok(hit.hits / checked >= 0.99, `hits agreement ${pct(hit.hits)}`);
  assert.ok(hit.toms / checked >= 0.75, `toms agreement ${pct(hit.toms)}`);
  assert.ok(hit.time / checked >= 0.75, `time agreement ${pct(hit.time)}`);
  assert.ok(hit.feel / checked >= 0.55, `feel agreement ${pct(hit.feel)}`);
  console.log(`tier 2 (ground truth, n=${checked}): PASS — header ${pct(hit.header)}, hits ${pct(hit.hits)}, toms ${pct(hit.toms)}, time ${pct(hit.time)}, feel ${pct(hit.feel)}`);
}).catch((e) => { console.error(e); process.exit(1); });
