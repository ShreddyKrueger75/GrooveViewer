const { app, BrowserWindow, dialog, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { scan, readNotes } = require('./scanner');
const { solidSquarePng } = require('./drag-icon');

const dragIcon = nativeImage.createFromBuffer(solidSquarePng(32, [216, 166, 87])); // --acc

// Scan, don't ship: the catalog is built by scanning the user's own library
// folder and cached (with the chosen path) in the OS per-user app-data dir.
const SETTINGS = () => path.join(app.getPath('userData'), 'settings.json');
const CACHE = () => path.join(app.getPath('userData'), 'catalog.json.gz');

let win;
let scanning = false; // one scan at a time — concurrent scans would clobber the cache
let libraryPath = null; // current scanned root — IPC handlers validate paths against this

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS(), 'utf8')); } catch { return {}; }
}
function writeSettings(patch) {
  fs.writeFileSync(SETTINGS(), JSON.stringify({ ...readSettings(), ...patch }));
}
// defense-in-depth: renderer-supplied paths (midi:notes/reveal/drag:start)
// must resolve inside the scanned library root, not just exist on disk
function withinLibrary(p) {
  if (!libraryPath || typeof p !== 'string') return false;
  const rel = path.relative(libraryPath, p);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

async function scanAndCache(root) {
  if (scanning) return { error: 'A scan is already running' };
  scanning = true;
  const progress = (msg) => {
    win.webContents.send('scan:progress', msg);
    return new Promise(setImmediate); // let the renderer paint
  };
  try {
    let prevByPath = null;
    try {
      const prev = JSON.parse(zlib.gunzipSync(fs.readFileSync(CACHE())).toString('utf8'));
      prevByPath = new Map(prev.map((r) => [r.path, r])); // unchanged files skip re-parse
    } catch { /* no prior cache — full scan */ }
    const records = await scan(root, progress, prevByPath);
    if (!records.length) return { error: `No MIDI files found in ${root}` };
    const json = JSON.stringify(records);
    const tmp = CACHE() + '.tmp'; // write-then-rename so a failed scan can't corrupt the cache
    fs.writeFileSync(tmp, zlib.gzipSync(json));
    fs.renameSync(tmp, CACHE());
    writeSettings({ libraryPath: root });
    libraryPath = root;
    return { json, libraryPath: root };
  } catch (e) {
    return { error: e.message };
  } finally {
    scanning = false;
  }
}

ipcMain.handle('catalog:load', () => {
  try {
    const json = zlib.gunzipSync(fs.readFileSync(CACHE())).toString('utf8');
    libraryPath = readSettings().libraryPath;
    return { json, libraryPath };
  } catch {
    return { json: null };
  }
});

ipcMain.handle('library:choose', async () => {
  if (scanning) return { error: 'A scan is already running' };
  const r = await dialog.showOpenDialog(win, {
    title: 'Choose your groove library folder',
    buttonLabel: 'Scan This Folder',
    properties: ['openDirectory'],
  });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  return scanAndCache(r.filePaths[0]);
});

ipcMain.handle('library:rescan', () => {
  const { libraryPath } = readSettings();
  if (!libraryPath) return { error: 'No library chosen yet' };
  return scanAndCache(libraryPath);
});

ipcMain.handle('midi:notes', (_e, p) => {
  if (!withinLibrary(p)) return { error: 'Path outside the scanned library' };
  try { return readNotes(p); } catch (e) { return { error: e.message }; }
});

ipcMain.on('reveal', (_e, p) => {
  if (withinLibrary(p) && fs.existsSync(p)) shell.showItemInFolder(p); // silent no-op if volume unmounted
});

// Drag-to-DAW: must be a synchronous IPC send from the renderer's own
// dragstart handler — startDrag() only works inside that native gesture.
ipcMain.on('drag:start', (event, filePath) => {
  if (withinLibrary(filePath) && fs.existsSync(filePath)) {
    event.sender.startDrag({ file: filePath, icon: dragIcon });
  }
});

// CC-BY 4.0 requires USER-VISIBLE attribution for the bundled DRSKit samples.
// The macOS default menu's "About GrooveViewer" shows this panel; keep the
// credits text in sync with assets/drskit/ATTRIBUTION.md.
app.setAboutPanelOptions({
  applicationName: 'GrooveViewer',
  applicationVersion: app.getVersion(),
  copyright: '© 2026 Bloody Finger Music',
  credits: 'Drum preview samples: DRSKit 2 by the DrumGizmo project — ' +
    'Lars Muldjord and Bent Bisballe Nyeng, with the drum kit provided by ' +
    'Jes Eiler of DRSDrums (drskit.dk). ' +
    'Used under the Creative Commons Attribution 4.0 International license ' +
    '(creativecommons.org/licenses/by/4.0). Samples unmodified; curated subset.',
});

app.whenReady().then(() => {
  const { winBounds } = readSettings();
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    ...winBounds,
    backgroundColor: '#0a0908',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.on('close', () => writeSettings({ winBounds: win.getBounds() }));
  win.loadFile('index.html');
});

app.on('window-all-closed', () => app.quit());
