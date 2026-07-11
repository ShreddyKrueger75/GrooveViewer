# GrooveViewer

@docs/claude/PROTOCOL.md
@docs/claude/PUBLISH-CHECKLIST.md
@.claude/rules/00-session-protocol.md
@.claude/STATUS.md

macOS desktop app that scans the user's own drum-groove MIDI libraries (SSD5,
EZdrummer/Superior, Groove Monkee, raw MIDI folders), catalogs and classifies
them by feel, previews them, and drags grooves straight into a DAW.

**The one non-negotiable: Scan, don't ship.** Never bundle, embed, or commit
groove MIDI data or catalogs derived from commercial libraries. `beat-catalog.html`
(the prototype, gitignored) embeds 396k copyrighted records — local dev reference
only, never committed.
