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

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS(), 'utf8')); } catch { return {}; }
}

async function scanAndCache(root) {
  const progress = (msg) => {
    win.webContents.send('scan:progress', msg);
    return new Promise(setImmediate); // let the renderer paint
  };
  try {
    const records = await scan(root, progress);
    if (!records.length) return { error: `No MIDI files found in ${root}` };
    const json = JSON.stringify(records);
    fs.writeFileSync(CACHE(), zlib.gzipSync(json));
    fs.writeFileSync(SETTINGS(), JSON.stringify({ libraryPath: root }));
    return { json, libraryPath: root };
  } catch (e) {
    return { error: e.message };
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

ipcMain.on('reveal', (_e, p) => shell.showItemInFolder(p));

// Drag-to-DAW: must be a synchronous IPC send from the renderer's own
// dragstart handler — startDrag() only works inside that native gesture.
ipcMain.on('drag:start', (event, filePath) => {
  if (typeof filePath === 'string' && fs.existsSync(filePath)) {
    event.sender.startDrag({ file: filePath, icon: dragIcon });
  }
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
