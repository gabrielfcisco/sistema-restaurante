import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
const devUrl = process.env.ELECTRON_RENDERER_URL;
if (devUrl && (app.isPackaged || new URL(devUrl).origin !== 'http://localhost:5173')) throw new Error('Origem de desenvolvimento inválida.');
const entry = new URL('../dist/index.html', import.meta.url);
function createWindow() {
  const window = new BrowserWindow({ width: 1440, height: 900, minWidth: 640, minHeight: 480, title: 'Restaurante — Recepção', autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (devUrl ? new URL(url).origin !== new URL(devUrl).origin : url !== entry.href) event.preventDefault();
  });
  // Permissões de câmera serão implementadas com a US-06, restritas ao app da mesa.
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

