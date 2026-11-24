const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('restaurante', {
  painel: () => ipcRenderer.invoke('restaurante:painel'),
  request: request => ipcRenderer.invoke('restaurante:api', request)
});

