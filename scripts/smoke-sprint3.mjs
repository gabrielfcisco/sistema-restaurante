import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
if (!/^operacao_desktop_test_[a-f0-9]{16}$/.test(process.env.OPERACAO_TEST_DATABASE ?? '')) throw new Error('Use somente o runner de banco descartável.');
app.on('window-all-closed', () => {});
const evaluate = (window, code) => window.webContents.executeJavaScript(code);
async function waitFor(window, expression) {
  await evaluate(window, `(async () => { for(let i=0;i<150;i++) {
    if(${expression}) return; await new Promise(resolve=>setTimeout(resolve,100));
  } throw new Error(document.body.innerText); })()`);
}
async function click(window, text) {
  await evaluate(window, `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
}
async function input(window, id, value) {
  await evaluate(window, `(() => {const el=document.getElementById(${JSON.stringify(id)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}
app.whenReady().then(async () => {
  let code = 0;
  try {
    for (const profile of ['garcom', 'administracao']) {
      const window = new BrowserWindow({ show: false, width: profile === 'garcom' ? 430 : 1440, height: 1000, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, partition: 'sprint3-' + profile } });
      const base = process.env.OPERACAO_TEST_API;
      window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://127.0.0.1:3333/api/*'] }, (details, callback) => callback({ redirectURL: base + details.url.slice('http://127.0.0.1:3333/api'.length) }));
      try {
        await window.loadFile(fileURLToPath(new URL('../apps/' + profile + '/dist/index.html', import.meta.url)));
        if (profile === 'garcom') {
          await waitFor(window, `document.querySelectorAll('.ready-card').length === 2`);
          await input(window, 'numero-mesa', '8'); await click(window, 'Buscar mesa');
          await waitFor(window, `document.querySelectorAll('#comanda option').length === 2`);
          await evaluate(window, `(() => {const e=document.getElementById('comanda');e.value='1';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
          await waitFor(window, `document.body.innerText.includes('Total parcial:') && document.body.innerText.includes('228,00')`);
          await click(window, 'Marcar como entregue');
          await waitFor(window, `document.body.innerText.includes('Confirme a entrega deste item')`);
          await click(window, 'Confirmar entrega');
          await waitFor(window, `document.querySelectorAll('.ready-card').length === 1 && document.body.innerText.includes('Entrega confirmada')`);
          assert.equal((await (await fetch(base + '/garcom/itens-prontos')).json()).length, 1);
          await input(window, 'numero-mesa', '999'); await click(window, 'Buscar mesa');
          await waitFor(window, `document.body.innerText.includes('Mesa não encontrada')`);
          assert.equal(await evaluate(window, `document.body.innerText.includes('Total parcial:')`), false);
        } else {
          await waitFor(window, `document.querySelectorAll('tbody tr').length === 3`);
          await click(window, '＋ Nova categoria'); await input(window, 'nome-categoria', 'Entradas de teste'); await click(window, 'Salvar categoria');
          await waitFor(window, `document.querySelectorAll('tbody tr').length === 4`);
          await click(window, '＋ Nova categoria'); await input(window, 'nome-categoria', 'ENTRADAS DE TESTE'); await click(window, 'Salvar categoria');
          await waitFor(window, `document.body.innerText.includes('Já existe uma categoria')`); await click(window, 'Cancelar');
          await evaluate(window, `[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('Entradas de teste')).querySelector('button').click()`);
          await input(window, 'nome-categoria', 'Entradas revisadas'); await click(window, 'Salvar categoria');
          await waitFor(window, `document.querySelector('tbody').innerText.includes('Entradas revisadas')`);
          await evaluate(window, `[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('Entradas revisadas')).querySelectorAll('button')[1].click()`);
          await click(window, 'Confirmar');
          await waitFor(window, `[...document.querySelectorAll('tbody tr')].some(r=>r.innerText.includes('Entradas revisadas') && r.querySelector('.status-inactive'))`);
          const categorias = await (await fetch(base + '/administracao/categorias')).json();
          assert.equal(categorias.find(c => c.nome === 'Entradas revisadas').ativo, false);
        }
        assert.equal(await evaluate(window, 'document.documentElement.scrollWidth <= window.innerWidth'), true);
        if (process.env.DESKTOP_SCREENSHOT_DIR) {
          await mkdir(process.env.DESKTOP_SCREENSHOT_DIR, { recursive: true });
          await writeFile(join(process.env.DESKTOP_SCREENSHOT_DIR, profile + '.png'), (await window.webContents.capturePage()).toPNG());
        }
        console.log(profile + ': ações reais, erros e layout sem overflow verificados.');
      } finally { window.destroy(); }
    }
  } catch (error) { console.error(error); code = 1; }
  finally { app.exit(code); }
});
