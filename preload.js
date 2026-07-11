const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('groove', {
  loadCatalog: () => ipcRenderer.invoke('catalog:load'),
  reveal: (p) => ipcRenderer.send('reveal', p),
});
