const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

// ponytail: dev-data catalog (extracted from the prototype, gitignored) is the
// only data source for now — the real library scanner replaces this later.
const CATALOG = path.join(__dirname, 'dev-data', 'catalog.json.gz');

ipcMain.handle('catalog:load', () => {
  if (!fs.existsSync(CATALOG)) {
    throw new Error('dev-data/catalog.json.gz missing — extract it from beat-catalog.html (see README)');
  }
  return zlib.gunzipSync(fs.readFileSync(CATALOG)).toString('utf8');
});

ipcMain.on('reveal', (_e, p) => shell.showItemInFolder(p));

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0a0908',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
});

app.on('window-all-closed', () => app.quit());
