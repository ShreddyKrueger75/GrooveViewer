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
const { analyze, scan, readNotes } = require('../scanner');

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
  let ok = 0, checked = 0;
  for (let i = 0; i < cat.length; i += 1000) {
    const r = cat[i];
    if (!fs.existsSync(r.path)) continue;
    checked++;
    const g = analyze(r.path);
    if (g.bpm === r.bpm && g.ts === r.ts && g.bars === r.bars) ok++;
  }
  assert.ok(ok / checked >= 0.99, `ground-truth agreement ${ok}/${checked}`);
  console.log(`tier 2 (ground truth): PASS — ${ok}/${checked} exact`);
}).catch((e) => { console.error(e); process.exit(1); });
