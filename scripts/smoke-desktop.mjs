// Executar com Electron após npm run build, com API disponível na porta padrão.
import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
let result = 0;
try {
  for (const name of ['recepcao', 'mesa']) {
    const window = new BrowserWindow({ show: false, width: 1194, height: 834,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    try {
      await window.loadFile(fileURLToPath(new URL('../apps/' + name + '/dist/index.html', import.meta.url)));
      const message = await window.webContents.executeJavaScript(`(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        for (let i = 0; i < 100 && !document.querySelector('button'); i++) await wait(50);
        const button = document.querySelector('button');
        if (!button) throw new Error('Interface não renderizou');
        button.click();
        for (let i = 0; i < 140; i++) {
          await wait(50);
          const text = document.querySelector('[role="status"]')?.textContent;
          if (text === 'Servidor conectado.') return text;
        }
        throw new Error(document.querySelector('[role="status"]')?.textContent ?? 'Sem status');
      })()`);
      assert.equal(message, 'Servidor conectado.');
      console.log(name + ': interface renderizada e API conectada no Electron.');
    } finally { window.destroy(); }
  }
} catch (error) {
  console.error(error);
  result = 1;
} finally { app.exit(result); }
});
