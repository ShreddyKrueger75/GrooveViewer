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

On first launch, point GrooveViewer at your groove library folder (e.g. your
SSD5 `Grooves` directory, an EZdrummer MIDI folder, or any folder of `.mid`
files). It scans the folder — tempo, time signature, and length come straight
from each MIDI file's headers — and caches the catalog in the OS app-data dir.
Use the **library…** button to switch folders or rescan. Feel/kick
classification arrives with the classifier milestone.

## Test

```
npm test
```

Runs the scanner self-check: a synthetic in-memory MIDI fixture, plus (when
the dev ground-truth data and library volume are present) a 397-file sample
compared against the prototype catalog — currently 396/397 exact.

## Dev ground truth (local only, gitignored)

`dev-data/catalog.json.gz` is the 396k-record catalog extracted from the
personal-use prototype (`beat-catalog.html`, also gitignored). The app never
reads it — it's the validation corpus for the scanner/classifier. To
regenerate it:

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

## Preview sounds

Groove preview plays the **actual MIDI notes** from each file through a
curated set of 21 acoustic drum one-shots from **DRSKit 2** by the
[DrumGizmo project](https://drumgizmo.org/kits/), used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — see
[assets/drskit/ATTRIBUTION.md](assets/drskit/ATTRIBUTION.md). The preview
BPM slider sets the playback tempo regardless of each file's native tempo.

## Roadmap (see `.claude/STATUS.md` for live state)

1. ✅ Electron shell + catalog browser (port of the prototype UI)
2. ✅ Library picker + scanner (header facts: BPM, time signature, bars)
3. ✅ Real MIDI playback for previews (DRSKit samples; replaced the
   prototype's synth caricature)
4. Feel classifier (rebuild the lost core intelligence: feel, kick pattern,
   cymbal, hit density)
5. Drag-to-DAW (the killer feature)
