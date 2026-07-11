# GrooveViewer

Scan, catalog, and preview your own drum-groove MIDI libraries (SSD5,
EZdrummer/Superior, Groove Monkee, raw MIDI folders). Cross-platform
Electron desktop app. Product #3 of Bloody Finger Music.

**The one non-negotiable: Scan, don't ship.** The app scans the user's own
installed libraries. No groove MIDI or catalog data derived from commercial
libraries is ever bundled, embedded, or committed.

## Run

```
npm install
npm start
```

## Dev data (local only, gitignored)

The app currently reads `dev-data/catalog.json.gz` — the 396k-record catalog
extracted from the personal-use prototype (`beat-catalog.html`, also
gitignored). To regenerate it:

```
python3 -c "
import re, base64
src = open('beat-catalog.html', encoding='utf-8').read()
m = re.search(r\"const B64='\", src)
blob = src[m.end():src.index(chr(39), m.end())]
import pathlib; pathlib.Path('dev-data').mkdir(exist_ok=True)
open('dev-data/catalog.json.gz','wb').write(base64.b64decode(blob))
"
```

The library scanner (a future milestone) replaces this dev catalog with a
scan of the user's own installed libraries.

## Roadmap (see `.claude/STATUS.md` for live state)

1. ✅ Electron shell + catalog browser (port of the prototype UI)
2. Library scanner + feel classifier (rebuild the lost core intelligence)
3. Real MIDI playback for previews (the current preview is a synth caricature)
4. Drag-to-DAW (the killer feature)
