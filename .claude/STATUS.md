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

## Known ceilings (deliberate, ponytail-marked)
- Preview is the prototype's synth caricature (kick from metadata, snare inferred from
  feel) — real MIDI playback is milestone 3
- 1,000-row render cap kept from prototype — virtualize when it hurts
- Catalog paths are the prototype's hardcoded `/Volumes/My Work/SSL/...` absolute paths —
  reveal/copy only work with that volume mounted; fixed for real when the scanner lands

## Next move
1. John reviews the diff on `claude/electron-shell` (three-gate merge: diff read ✅ by
   Claude, QA = John runs `npm start`, John merges)
2. Then milestone 2: the library scanner + feel classifier (Node), validated against the
   396k-record prototype catalog as ground truth

## Vault sync
⚠️ Vault handoff (Brain/session-log.md + Daily + Projects/Groove Library) not yet written
this session — sync pending.
