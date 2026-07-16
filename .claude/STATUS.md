# GrooveViewer — STATUS

**Updated:** 2026-07-11 (Claude session)
**Branch:** `claude/electron-shell` (working branch; main untouched)
**State:** UN-PARKED 2026-07-11 — John declared "getting serious." Bootstrapped + milestone 1 built.

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

## Known ceilings (deliberate, ponytail-marked)
- Feel/kick/cymbal columns still show "—" until the classifier milestone fills them
- Preview one-shots are mono close-mics (no room/overhead blend) — revisit if it
  sounds too dry
- Non-kit percussion notes (cowbell, claps, etc.) are skipped in preview
- Scan re-analyzes everything on rescan — incremental scan when libraries get huge
- Pack/section derived from folder segments relative to the chosen root — picking a
  single `.lib` pack makes its subfolders the "packs" (pick the parent Grooves folder
  for correct pack names)
- 1,000-row render cap kept from prototype — virtualize when it hurts

## Next move
1. John reviews the diff on `claude/electron-shell` (three-gate merge: diff read ✅ by
   Claude, QA = John runs `npm start` and picks his Grooves folder, John merges)
2. Then: the feel classifier in `scanner.js` (feel/kick/cymbal/hits/toms), validated
   against the 396k-record prototype catalog as ground truth

## Vault sync
✅ 2026-07-11: session-log line, Daily entry, and session note
(`Projects/Groove Library/Session — 2026-07-11 — GrooveViewer un-parked, Electron shell`)
all written.
