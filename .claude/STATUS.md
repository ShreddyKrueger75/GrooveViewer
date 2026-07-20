# GrooveViewer — STATUS

**Updated:** 2026-07-16 (Claude session)
**Branch:** `claude/quick-wins` (working branch; v1 merged to main @ `ed83efd`)
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

## v1 merged to main (2026-07-16, John's call)
`claude/electron-shell` fast-forwarded into `main` @ `ed83efd` and pushed. John's
hands-on QA (mix by ear, real DAW drag) still outstanding — merged on his explicit
instruction before that gate.

## Improvement roadmap (multi-agent review, verified against code, 2026-07-16)
Full findings in vault: `Projects/Groove Library/GrooveViewer — improvement roadmap`.
Condensed, prioritized:
1. **Before selling** — in-app About/credits w/ DRSKit CC-BY attribution (license
   obligation, currently invisible); LICENSE file (repo has none); Developer ID
   signing + notarization; README screenshot caption ("your own library").
2. **Core loop UX** — keyboard auditioning (arrows + space, auto-advance while
   playing); persist filter state + window size; master volume slider (doubles as
   TRIM-tuning tool); first-run guidance text.
3. **Real bugs** — concurrent-scan race (two scans clobber cache/settings);
   IPC path validation vs library root; unmounted-volume guards (reveal silent-fails);
   MIDI file-size guard.
4. **Audio/classifier** — 5–10ms fade-in envelope (kills attack clicks);
   per-library note maps (feel 71.5%→~85%, medium effort, data already in dev
   catalog); `cat` from folder names (fill/break only); lower hat TRIMs first if
   dense passages clip.
5. **Perf, paced** — Map lookup in attachPlayers (real win now); incremental rescan
   via mtime/size (when rescans annoy); parallel scan reads (v2, ~2–4x).
Rejected on verification (don't relitigate): virtualized rendering (cap fine),
favorites/collections (premature), auto-update + trial/licensing code (pre-ship
milestone, after monetization model chosen), IPC catalog transfer rework
(measured fine), "showItemInFolder is macOS-only" (false — cross-platform).

## In flight: `claude/quick-wins` (batch 1)
About box w/ CC-BY attribution + version · keyboard auditioning · scan-race fix ·
small guards (reveal existsSync, MIDI size cap, pickLibrary try/catch).

## Mr Robot pass (2026-07-20, John's trigger) — verdict: no ship-blockers
11-agent adversarial workflow (4 hostile lenses + live Electron runtime harness
against a real 210-file scan, every claim adversarially verified). Threat-model
axis clean: no paid APIs, no network, no new IPC surface; lock + reveal guard
narrow exposure vs main. Real findings, all fixed on the branch:
- Sticky-header occlusion on ArrowUp (runtime-measured) → selectRow now
  scrolls the row clear of the header (app.js)
- ■ indicator lost when the table re-renders mid-playback (preexisting on
  main, amplified by keyboard flow) → attachPlayers restores ■/playBtn for
  the playing row (app.js)
- About credits drifted from ATTRIBUTION.md (missing drskit.dk) → synced
  verbatim (main.js)
- Keyboard feature undiscoverable → hint in header sub-text + README section
Nits accepted as-is: library:choose two-dialog TOCTOU (unreachable through
the window-modal sheet; cache stays locked either way), single self-
overwriting orphan .tmp on failed scan. Refuted (don't relitigate):
MutationObserver ▶-race (microtask ordering), space-on-empty-list
"silent failure" (correct no-op behavior).
Re-verified after fixes: npm test green (tier 2 floors hold), all 4 runtime
checks pass (occlusion gone — row pins at chrome bottom 168px; key-repeat
race clean; empty-filter clean; ■ survives re-render), zero console errors.
Note: the runtime harness itself had two bugs on first pass (wrong input id
'search' vs 'q'; const redeclaration across executeJavaScript calls) — fixed
in scratchpad before trusting check 3/4 results.

## Next move
Batch 1 + mr-robot fixes done → John's gates: diff read + hands-on QA
(arrows/space/esc feel, About panel, mix by ear) → John merges.

## Vault sync
✅ 2026-07-11: session-log line, Daily entry, and session note
(`Projects/Groove Library/Session — 2026-07-11 — GrooveViewer un-parked, Electron shell`)
all written.
