const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('caixaApiUrl', decodeURIComponent(process.argv.find(v => v.startsWith('--caixa-api='))?.slice(12) ?? ''));
contextBridge.exposeInMainWorld('caixaDocumento', (action, idPreconta) => ipcRenderer.invoke('caixa:documento', { action, idPreconta }));
