const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('restaurante', {
  request: request => ipcRenderer.invoke('restaurante:api', request)
});
