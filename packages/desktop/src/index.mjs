import { app, ipcMain } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { readDesktopConfig, desktopRequest } from './transport.mjs';
export async function installApiBridge(window, profile, appDirectory, trustedUrl) {
  const configPath = process.env.RESTAURANTE_CONFIG ?? (app.isPackaged
    ? join(app.getPath('userData'), 'config.json')
    : fileURLToPath(new URL('.desktop-config.json', appDirectory)));
  const operational = profile === 'cozinha' || profile === 'bar';
  // Sem credencial de operador: somente os painéis usam localhost por padrão.
  const config = await readDesktopConfig(configPath, profile) ?? (operational && !process.env.RESTAURANTE_CONFIG
    ? await readDefaultPanelConfig(configPath) : null);
  const trusted = event => event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && trustedUrl(event.senderFrame.url);
  ipcMain.removeHandler('restaurante:painel');
  if (operational) ipcMain.handle('restaurante:painel', event => {
    if (!trusted(event) || !config) throw new Error('Configuração do painel indisponível.');
    return { apiUrl: config.apiUrl };
  });
  ipcMain.removeHandler('restaurante:api');
  ipcMain.handle('restaurante:api', async (event, value) => {
    if (!trusted(event)) {
      return { status: 403, data: { error: { code: 'ORIGEM_NEGADA', message: 'Origem não autorizada.' } } };
    }
    return desktopRequest(profile, config, value);
  });
}
async function readDefaultPanelConfig(path) {
  // Arquivo presente e inválido nunca deve ser ignorado silenciosamente.
  try { await readFile(path); return null; }
  catch (error) { return error.code === 'ENOENT' ? { apiUrl: 'http://127.0.0.1:3333/api' } : null; }
}

