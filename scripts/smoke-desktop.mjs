
// Verifica apps compilados com API real e configuração desktop provisionada.
import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { installApiBridge } from '@restaurante/desktop';
const fullFlow = process.env.RUN_DESKTOP_FLOW_TESTS === '1';
if (fullFlow && !/^sprint01_demo_[a-f0-9]{16}$/.test(process.env.DESKTOP_TEST_DATABASE ?? '')) throw new Error('Fluxo completo exige API apontando para banco descartável de demonstração.');
const captures = process.env.DESKTOP_SCREENSHOT_DIR;
app.on('window-all-closed', () => {});
async function evaluate(window, code) { return window.webContents.executeJavaScript(code); }
async function waitFor(window, expression) {
  return evaluate(window, `(async () => {
    for (let i = 0; i < 180; i++) {
      if (${expression}) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(document.querySelector('[role="alert"]')?.textContent || document.body.innerText);
  })()`);
}
async function input(window, id, value) {
  await evaluate(window, `(() => { const field = document.getElementById(${JSON.stringify(id)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)});
    field.dispatchEvent(new Event('input', { bubbles: true })); })()`);
}
async function click(window, text) {
  await evaluate(window, `(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent === ${JSON.stringify(text)});
    if (!button || button.disabled) throw new Error('Botão indisponível: ' + ${JSON.stringify(text)}); button.click(); })()`);
}
async function capture(window, name) {
  if (!captures) return;
  await mkdir(captures, { recursive: true });
  await writeFile(fileURLToPath(new URL(name + '.png', new URL('file:///' + captures.replace(/\\/g, '/') + '/'))), (await window.webContents.capturePage()).toPNG());
}
app.whenReady().then(async () => {
  let exitCode = 0;
  try {
    for (const name of ['recepcao', 'mesa']) {
      const directory = new URL('../apps/' + name + '/', import.meta.url);
      const entry = new URL('dist/index.html', directory);
      const window = new BrowserWindow({ show: false, width: 1440, height: 1000,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: fileURLToPath(new URL('electron/preload.cjs', directory)) } });
      window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      window.webContents.session.setPermissionCheckHandler(() => false);
      try {
        await installApiBridge(window, name, directory, url => url === entry.href);
        await window.loadFile(fileURLToPath(entry));
        await waitFor(window, '!!document.querySelector("button")');
        assert.deepEqual(await evaluate(window, 'Object.keys(window.restaurante)'), ['request']);
        const health = await evaluate(window, 'window.restaurante.request({path: "/health", method: "GET"})');
        assert.equal(health.status, 200);
        if (name === 'recepcao') {
          await waitFor(window, 'document.querySelectorAll(".table-card").length > 0');
          await capture(window, 'recepcao-mapa');
          if (fullFlow) {
            await input(window, 'cpf', '12345678909'); await click(window, 'Buscar');
            await waitFor(window, '!!document.getElementById("nome")');
            await input(window, 'nome', 'Cliente Fictício da Demonstração'); await input(window, 'telefone', '(11) 00000-0000');
            await click(window, 'Cadastrar cliente');
            await waitFor(window, '!!document.querySelector(".client-summary")');
            await evaluate(window, 'document.querySelector(".table-card.livre").click()');
            await input(window, 'cartao', '01234'); await click(window, 'Abrir comanda');
            await waitFor(window, '!!document.querySelector(".success .access-code")');
            assert.equal(await evaluate(window, 'document.querySelector(".access-code").textContent'), '01234');
            assert.equal(await evaluate(window, 'document.querySelectorAll(".success img").length'), 1);
            await evaluate(window, 'document.querySelector(".success").scrollIntoView()');
            await capture(window, 'recepcao-comanda');
            await click(window, 'Próximo cliente');
            assert.equal(await evaluate(window, 'document.getElementById("cpf").value'), '');
          }
        } else {
          await waitFor(window, '!!document.getElementById("codigo")');
          await capture(window, 'mesa-identificacao');
          if (fullFlow) {
            await input(window, 'codigo', '01234'); await click(window, 'Acessar atendimento');
            await waitFor(window, '!!document.querySelector(".welcome")');
            assert.match(await evaluate(window, 'document.querySelector(".welcome").textContent'), /Cliente Fictício da Demonstração/);
            await capture(window, 'mesa-atendimento');
            await click(window, 'Sair / trocar cliente');
            await waitFor(window, '!!document.getElementById("codigo")');
            assert.doesNotMatch(await evaluate(window, 'document.body.innerText'), /Cliente Fictício da Demonstração/);
            assert.equal(await evaluate(window, 'document.getElementById("codigo").value'), '');
            await click(window, 'Escanear QR Code');
            await waitFor(window, '!!document.querySelector("[role=alert]")');
            assert.match(await evaluate(window, 'document.querySelector("[role=alert]").textContent'), /câmera|vídeo/i);
            assert.equal(await evaluate(window, 'document.getElementById("codigo").disabled'), false);
          }
        }
        console.log(name + ': interface, preload isolado e integração com API verificados' + (fullFlow ? ', incluindo atendimento real.' : '.'));
      } finally { window.destroy(); }
    }
  } catch (error) { console.error(error); exitCode = 1; }
  finally { app.exit(exitCode); }
});
