import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { installApiBridge } from '@restaurante/desktop';
const devUrl = process.env.ELECTRON_RENDERER_URL;
if (devUrl && (app.isPackaged || new URL(devUrl).origin !== 'http://localhost:5174')) throw new Error('Origem de desenvolvimento inválida.');
const entry = new URL('../dist/index.html', import.meta.url);
async function createWindow() {
  const window = new BrowserWindow({ width: 1194, height: 834, minWidth: 640, minHeight: 480, title: 'Restaurante — Mesa', autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)) } });
  await installApiBridge(window, 'mesa', new URL('../', import.meta.url), url => devUrl ? new URL(url).origin === new URL(devUrl).origin : url === entry.href);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (devUrl ? new URL(url).origin !== new URL(devUrl).origin : url !== entry.href) event.preventDefault();
  });
  const trusted = contents => contents === window.webContents && (devUrl
    ? contents.getURL().startsWith(devUrl + '/') || contents.getURL() === devUrl
    : contents.getURL() === entry.href);
  window.webContents.session.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(trusted(contents) && permission === 'media' && details.isMainFrame
      && details.mediaTypes?.length === 1 && details.mediaTypes[0] === 'video');
  });
  window.webContents.session.setPermissionCheckHandler((contents, permission, _origin, details) =>
    !!contents && trusted(contents) && permission === 'media' && details.mediaType === 'video');
  if (devUrl) void window.loadURL(devUrl);
  else void window.loadFile(fileURLToPath(entry));
}
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

