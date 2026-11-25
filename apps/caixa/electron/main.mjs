import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { htmlPreconta } from './documento.mjs';

const devUrl = process.env.ELECTRON_RENDERER_URL;
if (devUrl && (app.isPackaged || new URL(devUrl).origin !== 'http://localhost:5179')) throw new Error('Origem de desenvolvimento inválida.');
const entry = new URL('../dist/index.html', import.meta.url);
const api = new URL(process.env.RESTAURANTE_CAIXA_API_URL ?? process.env.VITE_API_URL ?? 'http://127.0.0.1:3333/api');
const parts = api.hostname.split('.').map(Number);
const interna = ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname) || (parts.length === 4 && parts.every(v => Number.isInteger(v) && v >= 0 && v <= 255) && (parts[0] === 10 || parts[0] === 192 && parts[1] === 168 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
if (api.username || api.password || api.search || api.hash || api.pathname !== '/api' || (api.protocol !== 'https:' && !(api.protocol === 'http:' && interna))) throw new Error('API do caixa inválida.');
let documentoOcupado = false;
ipcMain.handle('caixa:documento', async (event, value) => {
  const parent = BrowserWindow.fromWebContents(event.sender);
  const origin = event.senderFrame?.url;
  if (!parent || event.senderFrame !== event.sender.mainFrame || (devUrl ? origin !== devUrl && origin !== devUrl + '/' : origin !== entry.href) || documentoOcupado || !value || !['pdf', 'imprimir'].includes(value.action) || !Number.isSafeInteger(value.idPreconta) || value.idPreconta < 1) throw new Error('Documento inválido.');
  documentoOcupado = true; let preview;
  try {
    const r = await fetch(api.href + '/caixa/precontas/' + value.idPreconta, { redirect: 'error', signal: AbortSignal.timeout(12000) });
    // Somente snapshots persistidos da API configurada; nunca HTML enviado pelo renderer.
    if (!r.ok) throw new Error('Pré-conta indisponível.');
    const p = await r.json();
    if (p.idPreconta !== value.idPreconta || !Array.isArray(p.itens) || !Array.isArray(p.taxas)) throw new Error('Pré-conta inválida.');
    preview = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    preview.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    preview.webContents.on('will-navigate', e => e.preventDefault());
    await preview.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlPreconta(p)));
    if (value.action === 'pdf') {
      const choice = await dialog.showSaveDialog(parent, { defaultPath: 'preconta-' + p.idPreconta + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (choice.canceled || !choice.filePath) return { cancelado: true };
      const path = choice.filePath.toLowerCase().endsWith('.pdf') ? choice.filePath : choice.filePath + '.pdf';
      await writeFile(path, await preview.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true }));
    } else await new Promise((resolve, reject) => preview.webContents.print({ silent: false, printBackground: true }, (ok, reason) => ok ? resolve() : reject(new Error(reason || 'Impressão cancelada.'))));
    return { cancelado: false };
  } finally { preview?.destroy(); documentoOcupado = false; }
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 960,
    minHeight: 700,
    title: 'Restaurante — Caixa',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)), additionalArguments: ['--caixa-api=' + encodeURIComponent(api.href)] }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (devUrl ? new URL(url).origin !== new URL(devUrl).origin : url !== entry.href) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  if (devUrl) void window.loadURL(devUrl);
  else void window.loadFile(fileURLToPath(entry));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
