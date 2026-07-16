# GrooveViewer — STATUS

**Updated:** 2026-07-11 (Claude session)
**Branch:** `claude/electron-shell` (working branch; main untouched)
**State:** UN-PARKED 2026-07-11 — John declared "getting serious," then said "finish the
app." Full v1 roadmap built this session: shell → scanner → real preview → classifier →
drag-to-DAW → desktop packaging. Branch is unpushed, unmerged — review/merge is next,
not done automatically per the three-gate rule.

## Decisions (John, 2026-07-11)
- **Platform: cross-platform** (not Mac-native SwiftUI — overrides the old lean in PARKED.md)
- **Stack: Electron** (all-JS; prototype UI ports directly; `webContents.startDrag` for drag-to-DAW later)
- **Milestone order: UI-first** — app shell + catalog browser before the scanner rebuild

## What landed this session
- Protocol bootstrap: `CLAUDE.md`, `docs/claude/PROTOCOL.md` (+ canonical facts),
  `docs/claude/PUBLISH-CHECKLIST.md`, `.claude/rules/00-session-protocol.md`, this file
- `.gitignore` hardened: `beat-catalog.html` (copyrighted embedded data), `dev-data/`, `node_modules/`
- `dev-data/catalog.json.gz` extracted from the prototype (396,510 records, local-only)
- **Electron shell (milestone 1):** `main.js` + `preload.js` + `index.html` + `style.css` + `app.js`
  — full port of the prototype browser: search/filter/sort, column show/hide, synth preview
  with BPM slider, copy-path, reveal-in-Finder (now native `shell.showItemInFolder`,
  replacing the lost Python helper). Smoke-tested: loads all 396,510 records, renders,
  screenshot verified. Electron 43.1.0, `npm audit` clean.

## Milestone 1.5 (John's change request, same session): library picker + scanner
- App no longer reads John's dev catalog — first run shows "Choose your groove library…";
  picking a folder scans it (walk for `.mid`/`.midi` → parse headers via `midi-file` npm)
  and caches catalog + chosen path in the OS userData dir. "library…" button re-picks.
- `scanner.js` extracted (no Electron deps) — the classifier will live there too.
- Scanner analyze() validated against the prototype catalog as ground truth: **396/397
  exact** on bpm/ts/bars (rule: first setTempo + first timeSignature win; bars = ceil to
  last note ATTACK). BPM null when the file embeds no tempo — matches truth (264k/396k).
- `npm test` = `test/scan-check.js`: synthetic in-memory MIDI fixture (always) +
  ground-truth sample comparison (when dev-data + volume present). Both pass.
- E2E smoke via capturePage: first-run picker state + real scan of the Groove Monkee
  freebie pack (210 files) → catalog renders with real parsed data.

## Milestone: real sample-based preview (same session)
- **Samples: DRSKit 2 (DrumGizmo), CC-BY 4.0** — 21 curated unmodified one-shots
  (kick/snare/closed+open hat/3 toms/crash/ride, 2–3 velocity layers), 3.5 MB, committed
  at `assets/drskit/` with `ATTRIBUTION.md`. License research in vault:
  `Projects/Groove Library/Drum samples for preview — license research`.
  Rejected: Salamander (CC-BY-SA share-alike), "royalty-free" packs (no redistribution).
- **Preview now plays the real MIDI**: `scanner.readNotes()` → IPC → WebAudio sampler
  (GM-ish note buckets → 9 voices, velocity → layer + gain, per-file peak normalize +
  per-instrument TRIM knobs, hi-hat choke, master-gain kill switch on stop). Synth
  caricature deleted. ▶ restored on all rows — no classifier dependency.
- Velocity ordering of DRSKit sample indices verified by measured peak/RMS.
  `npm test` extended with readNotes fixture assertions. E2E: scan → ▶ shows ■,
  loops, stop restores ▶, zero console errors.
- ⚠️ Mix quality is untuned-by-ear (TRIM constants in app.js) — John should judge and
  we tweak numbers.

## Milestone: desktop app packaging (same session)
- `npm run package` → `dist/mac-arm64/GrooveViewer.app` (electron-builder, `--mac dir`);
  `npm run dist` makes the DMG when we want one. Launch smoke-tested.
- **Whitelist bundling** (`build.files` in package.json) so `dev-data/` and
  `beat-catalog.html` can never leak into the bundle — asar contents audited clean.
- Signed with John's local Apple Development cert automatically; **Developer ID signing +
  notarization + app icon still TODO at release**. appId placeholder:
  `com.bloodyfinger.grooveviewer` (bundle id is TBD in canonical facts).

## Milestone: feel classifier (same session)
- `scanner.classify()` — reverse-engineered against the 396k ground-truth catalog the
  same way header facts were: dumped raw MIDI note ticks for records across every
  cat/feel/kick/time value, found the underlying rule per field, measured accuracy at
  scale (~400-record stride-1000 sample), iterated thresholds, re-measured.
- **kick**: bar-relative 16-grid positions (mod barTicks) IF the pattern repeats
  identically every bar → `"1,3"` / `"4-on-floor"` notation exactly matching the
  prototype's; else `"N hits"` (N = union of positions across bars) rather than a
  confidently wrong single-bar label.
- **time** (cymbal): open-hat > ride > closed-hat > none, by note presence.
- **toms**: any tom-range note present.
- **feel**: driven by the snare's unique bar-relative grid positions — exact-match
  rules for `{8}`→half-time, `{0,4,8,12}`→fast-one-beat, backbeat-shape→straight
  backbeat, else density-bucketed (empty/no-snare/backbeat-ish/d-beat-gallop/busy-fill).
- **Measured accuracy** (n=397, ground truth): header facts 99.7%, hits 100%, toms
  87.7%, cymbal 91.2%, feel 71.5%. Real, documented ceiling — MIDI note-number-to-
  drum-piece mapping isn't standardized across SSD5/EZX/Groove Monkee, so kick/feel
  can't hit header-fact precision without a per-library note map (future work, not
  now). `npm test` asserts floors at these measured levels, not 100%.
- ▶ preview unaffected (already played real notes, independent of classifier).

## Milestone: drag-to-DAW (same session)
- Drag any **file name** cell out of the table → `webContents.startDrag()` in
  `main.js`, triggered by a renderer `dragstart` → sync IPC (`drag:start`).
- Drag-cursor icon: `drag-icon.js` hand-writes a minimal 32×32 solid-color PNG
  (brand `--acc`) via a from-scratch CRC32 + PNG-chunk encoder — no new dependency,
  no external asset. `nativeImage.createFromBuffer` confirmed non-empty/32×32.
- E2E-verified up to the OS handoff: real `dragstart` in a loaded renderer → exact
  file path arrives at the main-process IPC handler. The actual native drag-into-a-
  DAW-window gesture needs John's hands — can't be scripted headlessly (same class
  of gate as TetherMT's hardware checks).

## Milestone: desktop app packaging, updated for the new files
- Re-packaged after classifier + drag-icon.js landed; `build.files` whitelist updated
  to include `drag-icon.js`; asar re-audited clean (no dev-data/beat-catalog leakage).
  Packaged `.app` launch re-verified.

## Known ceilings (deliberate, ponytail-marked)
- Classifier accuracy ceiling documented above — kick/feel are the fuzzy fields;
  header facts and hit-count remain near-exact
- Preview one-shots are mono close-mics (no room/overhead blend) — revisit if it
  sounds too dry
- Non-kit percussion notes (cowbell, claps, etc.) are skipped in preview
- Scan re-analyzes everything on rescan — incremental scan when libraries get huge
- Pack/section derived from folder segments relative to the chosen root — picking a
  single `.lib` pack makes its subfolders the "packs" (pick the parent Grooves folder
  for correct pack names)
- 1,000-row render cap kept from prototype — virtualize when it hurts
- Drag icon is a flat brand-color square, not real iconography (placeholder, documented
  in drag-icon.js)
- App icon, Developer ID signing, notarization still open for a real release build
- `cat` field (fill/break/groove/etc.) still uses the simple filename heuristic from
  milestone 1.5, not reverse-engineered from note data — lowest-priority remaining gap

## Next move
John reviews the diff on `claude/electron-shell` (three-gate merge: diff read ✅ by
Claude, QA = John runs `npm start` or the packaged `.app`, picks his Grooves folder,
judges the classifier/preview mix by ear, tries a real drag into his DAW — then merges).

## Vault sync
✅ 2026-07-11: session-log line, Daily entry, and session note
(`Projects/Groove Library/Session — 2026-07-11 — GrooveViewer un-parked, Electron shell`)
all written.
