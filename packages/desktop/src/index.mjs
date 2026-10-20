import { app, ipcMain } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDesktopConfig, desktopRequest } from './transport.mjs';
export async function installApiBridge(window, profile, appDirectory, trustedUrl) {
  const configPath = process.env.RESTAURANTE_CONFIG ?? (app.isPackaged
    ? join(app.getPath('userData'), 'config.json')
    : fileURLToPath(new URL('.desktop-config.json', appDirectory)));
  const config = await readDesktopConfig(configPath);
  ipcMain.removeHandler('restaurante:api');
  ipcMain.handle('restaurante:api', async (event, value) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !trustedUrl(event.senderFrame.url)) {
      return { status: 403, data: { error: { code: 'ORIGEM_NEGADA', message: 'Origem não autorizada.' } } };
    }
    return desktopRequest(profile, config, value);
  });
}

