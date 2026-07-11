const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('groove', {
  loadCatalog: () => ipcRenderer.invoke('catalog:load'),
  chooseLibrary: () => ipcRenderer.invoke('library:choose'),
  rescanLibrary: () => ipcRenderer.invoke('library:rescan'),
  reveal: (p) => ipcRenderer.send('reveal', p),
  onScanProgress: (cb) => ipcRenderer.on('scan:progress', (_e, msg) => cb(msg)),
});
