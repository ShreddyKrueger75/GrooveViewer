# GrooveViewer — PARKED

**Status:** Parked 2026-06-12. Not started. Product #3 for Bloody Finger Music.

A desktop app (macOS, SwiftUI) that scans the user's own drum-groove MIDI
libraries (SSD5, EZdrummer/Superior, Groove Monkee, raw MIDI folders),
catalogs and classifies them, previews them, and drags grooves straight
into a DAW.

## Why parked, not built
ChaosPad (product #1) ships first. GrooveViewer waits its turn. This folder
is a placeholder so the work has a home when it's time.

## When you resume, read these first
- **Teardown of the prototype:** vault → `Projects/CHAOS EDITOR/Groove Viewer — Teardown.md`
  (full reverse-engineering of `beat-catalog.html`: data format, decode
  pipeline, preview engine, what's lost vs recoverable)
- **Business frame:** vault → `Projects/CHAOS EDITOR/Bloody Finger Music.md`
- **Working prototype:** `/Volumes/My Work/SSL/SSD5Library/beat-catalog.html`
  (6.2 MB single-file app; personal-use only — embeds copyrighted Slate/
  Groove Monkee groove data)

## The one non-negotiable at resume time
**Scan, don't ship.** The prototype embeds 396k copyrighted groove records.
The product must scan the user's *own* installed libraries — never bundle
the data. This is both the legal requirement and the bigger product.

## Decisions still open
- Platform: Mac-native (SwiftUI) vs cross-platform — leaning Mac-first
- The lost piece to rebuild first: the MIDI scanner + feel classifier
  (the original intelligence; was a Python script, now gone)
- Killer feature to prioritize: drag-to-DAW

---

## RESUMED 2026-07-11
John un-parked the project ("getting serious"). Bootstrapped per protocol:
`CLAUDE.md`, `docs/claude/`, `.claude/rules/00-session-protocol.md`, `.claude/STATUS.md`.
Current state lives in `.claude/STATUS.md` — this file is now historical.
