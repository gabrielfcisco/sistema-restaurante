import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { installApiBridge } from '@restaurante/desktop';
if (!/^operacao_desktop_test_[a-f0-9]{16}$/.test(process.env.OPERACAO_TEST_DATABASE ?? '')) throw new Error('Executar somente pelo runner de banco descartável.');
app.on('window-all-closed', () => {});
const evaluate = (window, code) => window.webContents.executeJavaScript(code);
async function waitFor(window, expression) {
  await evaluate(window, `(async () => { for(let i=0;i<200;i++) {
    if(${expression}) return; await new Promise(resolve=>setTimeout(resolve,100));
  } throw new Error(document.body.innerText); })()`);
}
async function clickCard(window, id) {
  await evaluate(window, `document.querySelector('[data-item-id="${id}"] button').click()`);
}
app.whenReady().then(async () => {
  let code = 0;
  try {
    for (const [profile, id, ownProduct, otherProduct] of [['cozinha', 1, 'File ao molho', 'Suco de laranja'], ['bar', 2, 'Suco de laranja', 'File ao molho']]) {
      const directory = new URL('../apps/' + profile + '/', import.meta.url), entry = new URL('dist/index.html', directory);
      const window = new BrowserWindow({ show: false, width: 1440, height: 900,
        webPreferences: { nodeIntegration: false, sandbox: true, contextIsolation: true, preload: fileURLToPath(new URL('electron/preload.cjs', directory)) } });
      try {
        await installApiBridge(window, profile, directory, url => url === entry.href);
        await window.loadFile(fileURLToPath(entry));
        await waitFor(window, 'document.querySelectorAll(".operation-card").length === 3 && !!document.querySelector(".connection-badge.conectado")');
        const text = await evaluate(window, 'document.body.innerText');
        assert.ok(text.includes(ownProduct)); assert.ok(!text.includes(otherProduct));
        assert.ok(text.includes('Comanda #1')); assert.ok(text.includes('Mesa 08'));
        assert.deepEqual(await evaluate(window, 'Object.keys(window.restaurante).sort()'), ['painel', 'request']);
        const wrong = profile === 'cozinha' ? 'bar' : 'cozinha';
        assert.equal((await evaluate(window, `window.restaurante.request({path:'/${wrong}/itens',method:'GET'})`)).status, 403);
        await evaluate(window, `(() => { const select=document.getElementById('status-fila'); select.value='PRONTO';select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
        await waitFor(window, 'document.querySelectorAll(".operation-column").length === 1');
        await evaluate(window, `(() => { const select=document.getElementById('status-fila'); select.value='';select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
        await waitFor(window, 'document.querySelectorAll(".operation-column").length === 3');
        if (process.env.DESKTOP_SCREENSHOT_DIR) {
          await mkdir(process.env.DESKTOP_SCREENSHOT_DIR, { recursive: true });
          await writeFile(join(process.env.DESKTOP_SCREENSHOT_DIR, profile + '.png'), (await window.webContents.capturePage()).toPNG());
        }
        for (const status of ['em_preparo', 'pronto']) {
          await clickCard(window, id);
          await waitFor(window, `!!document.querySelector('.operation-column.${status} [data-item-id="${id}"]') && !document.querySelector('[data-item-id="${id}"] button:disabled')`);
        }
        // Arrasta para trás e para frente e verifica a fila real do garçom nos dois setores.
        for (const destino of ['em_preparo', 'recebido', 'em_preparo', 'pronto']) {
          await evaluate(window, `(() => {
            const card = document.querySelector('[data-item-id="${id}"]');
            const target = document.querySelector('.operation-column.${destino}');
            const dataTransfer = new DataTransfer();
            card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
            return new Promise(resolve => setTimeout(() => {
              target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
              target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
              card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
              resolve();
            }, 0));
          })()`);
          await waitFor(window, `!!document.querySelector('.operation-column.${destino} [data-item-id="${id}"]') && !document.querySelector('[data-item-id="${id}"] button:disabled')`);
          const fila = await (await fetch(process.env.OPERACAO_TEST_API + '/garcom/itens-prontos')).json();
          assert.equal(fila.some(i => i.idItem === id), destino === 'pronto');
        }
        const entrega = await fetch(process.env.OPERACAO_TEST_API + '/garcom/itens/' + id + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statusAtual: 'PRONTO', status: 'ENTREGUE' }) });
        assert.equal(entrega.status, 200);
        await waitFor(window, `!document.querySelector('[data-item-id="${id}"]')`);
        window.webContents.session.webRequest.onBeforeRequest({ urls: [process.env.OPERACAO_TEST_API + '/*'] }, (_details, callback) => callback({ cancel: true }));
        await evaluate(window, 'document.querySelector(".operation-refresh").click()');
        await waitFor(window, '!!document.querySelector(".connection-badge.reconectando")');
        assert.equal(await evaluate(window, '[...document.querySelectorAll(".operation-action")].every(b=>b.disabled)'), true);
        window.webContents.session.webRequest.onBeforeRequest(null);
        // O EventSource deve reconectar sozinho, sem recarregar a interface.
        await waitFor(window, '!!document.querySelector(".connection-badge.conectado") && document.querySelectorAll(".operation-card").length === 2');
        window.setSize(840, 620);
        await waitFor(window, 'window.innerWidth <= 840');
        assert.equal(await evaluate(window, 'document.documentElement.scrollWidth <= window.innerWidth'), true);
        console.log(profile + ': setor isolado, filtros, fluxo completo, reconexão e layout verificados.');
      } finally { window.webContents.session.webRequest.onBeforeRequest(null); window.destroy(); }
    }
  } catch (error) { console.error(error); code = 1; }
  finally { app.exit(code); }
});
