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

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS(), 'utf8')); } catch { return {}; }
}

async function scanAndCache(root) {
  if (scanning) return { error: 'A scan is already running' };
  scanning = true;
  const progress = (msg) => {
    win.webContents.send('scan:progress', msg);
    return new Promise(setImmediate); // let the renderer paint
  };
  try {
    const records = await scan(root, progress);
    if (!records.length) return { error: `No MIDI files found in ${root}` };
    const json = JSON.stringify(records);
    const tmp = CACHE() + '.tmp'; // write-then-rename so a failed scan can't corrupt the cache
    fs.writeFileSync(tmp, zlib.gzipSync(json));
    fs.renameSync(tmp, CACHE());
    fs.writeFileSync(SETTINGS(), JSON.stringify({ libraryPath: root }));
    return { json, libraryPath: root };
  } catch (e) {
    return { error: e.message };
  } finally {
    scanning = false;
  }
}

ipcMain.handle('catalog:load', () => {
  try {
    return {
      json: zlib.gunzipSync(fs.readFileSync(CACHE())).toString('utf8'),
      libraryPath: readSettings().libraryPath,
    };
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
  try { return readNotes(p); } catch (e) { return { error: e.message }; }
});

ipcMain.on('reveal', (_e, p) => {
  if (typeof p === 'string' && fs.existsSync(p)) shell.showItemInFolder(p); // silent no-op if volume unmounted
});

// Drag-to-DAW: must be a synchronous IPC send from the renderer's own
// dragstart handler — startDrag() only works inside that native gesture.
ipcMain.on('drag:start', (event, filePath) => {
  if (typeof filePath === 'string' && fs.existsSync(filePath)) {
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
    'Lars Muldjord and Bent Bisballe Nyeng, drum kit by Jes Eiler of DRSDrums. ' +
    'Used under the Creative Commons Attribution 4.0 International license ' +
    '(creativecommons.org/licenses/by/4.0). Samples unmodified; curated subset.',
});

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0a0908',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
});

app.on('window-all-closed', () => app.quit());
