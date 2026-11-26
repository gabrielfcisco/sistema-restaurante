import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { installApiBridge } from '@restaurante/desktop';
import { htmlPreconta } from '../apps/caixa/electron/documento.mjs';
if (!/^sprint04_desktop_test_[a-f0-9]{16}$/.test(process.env.SPRINT4_TEST_DATABASE ?? '')) throw new Error('Use o runner descartável.');
const base = process.env.SPRINT4_TEST_API;
app.on('window-all-closed', () => {});
const evaluate = async (w, code) => { const r = await w.webContents.executeJavaScript(`(async()=>{try{return await (${code});}catch(e){return {__smokeError:String(e),stack:e.stack};}})()`); if(r?.__smokeError)throw new Error(r.__smokeError + String(r.stack)); return r; };
async function waitFor(w, expression) { await evaluate(w, `(async()=>{for(let n=0;n<200;n++){if(${expression})return;await new Promise(r=>setTimeout(r,100));}throw new Error(document.body.innerText);})()`); }
async function click(w, text) { await evaluate(w, `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().endsWith(${JSON.stringify(text)}));if(!b||b.disabled)throw new Error('Botão indisponível: '+${JSON.stringify(text)});b.click();})()`); }
async function input(w, selector, value, select = false) { await evaluate(w, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${select ? 'HTMLSelectElement' : 'HTMLInputElement'}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('${select ? 'change' : 'input'}',{bubbles:true}));})()`); }
async function label(w, text, value, select = false) { const selector = await evaluate(w, `(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.childNodes[0]?.textContent.trim()===${JSON.stringify(text)});const e=l?.querySelector('input,select');if(!e)throw new Error('Campo ausente '+${JSON.stringify(text)});e.id=e.id||'smoke-field-'+Math.random().toString(36).slice(2);return '#'+e.id;})()`); await input(w, selector, value, select); }
async function snapshot(w, name) {
  await evaluate(w, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  assert.equal(await evaluate(w, 'document.documentElement.scrollWidth <= window.innerWidth'), true, name + ' tem overflow');
  if (process.env.DESKTOP_SCREENSHOT_DIR) { await mkdir(process.env.DESKTOP_SCREENSHOT_DIR, { recursive: true }); await writeFile(join(process.env.DESKTOP_SCREENSHOT_DIR, name + '.png'), (await w.webContents.capturePage()).toPNG()); }
}
app.whenReady().then(async()=>{
  const windows = []; let code = 0;
  try {
    const open = async (profile, width = 1440) => {
      const entry = new URL('../apps/' + profile + '/dist/index.html', import.meta.url);
      const w = new BrowserWindow({show:false,width,height:1000,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,partition:'sprint4-'+profile,...(profile==='mesa'?{preload:fileURLToPath(new URL('../apps/mesa/electron/preload.cjs',import.meta.url))}:{})}}); windows.push(w);
      w.webContents.session.webRequest.onBeforeRequest({urls:['http://127.0.0.1:3333/api/*']},(details,callback)=>callback({redirectURL:base+details.url.slice('http://127.0.0.1:3333/api'.length)}));
      if(profile==='mesa')await installApiBridge(w,'mesa',new URL('../apps/mesa/',import.meta.url),url=>url===entry.href);
      await w.loadFile(fileURLToPath(entry)); return w;
    };
    const admin = await open('administracao'); await waitFor(admin,"document.querySelectorAll('tbody tr').length===3"); await click(admin,'Nova categoria'); await input(admin,'#nome-categoria','Categoria para excluir'); await click(admin,'Salvar categoria'); await waitFor(admin,"document.querySelector('tbody').innerText.includes('Categoria para excluir')");
    await evaluate(admin,"[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('Categoria para excluir')).querySelector('.acao-perigo').click()"); await click(admin,'Confirmar exclusão'); await waitFor(admin,"!document.querySelector('tbody').innerText.includes('Categoria para excluir')");
    await click(admin,'Produtos'); await waitFor(admin,"document.body.innerText.includes('Novo produto')");
    await label(admin,'Nome','Bebida cadastrada no teste'); await label(admin,'Preço (R$)','12.35'); await label(admin,'Categoria','BEBIDA',true); await label(admin,'Setor responsável','BAR',true); await click(admin,'Salvar produto');
    await waitFor(admin,"document.querySelector('tbody').innerText.includes('Bebida cadastrada no teste')"); await snapshot(admin,'sprint4-produtos');
    await evaluate(admin,"[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('Bebida cadastrada no teste')).querySelector('button').click()");
    await label(admin,'Preço (R$)','15.50');
    await evaluate(admin,"(()=>{const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='),c=>c.charCodeAt(0));const dt=new DataTransfer();dt.items.add(new File([bytes],'foto.png',{type:'image/png'}));const e=document.querySelector('input[type=file]');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await click(admin,'Salvar produto'); await waitFor(admin,"document.querySelector('tbody').innerText.includes('15,50') && document.querySelector('.product-photo-thumb')?.naturalWidth>0");
    await evaluate(admin,"[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('Bebida cadastrada no teste')).querySelector('button').click()"); await snapshot(admin,'sprint4-editar-produto'); await click(admin,'Cancelar edição');
    await label(admin,'Nome','Produto para excluir'); await label(admin,'Preço (R$)','1'); await label(admin,'Categoria','PRATO',true); await click(admin,'Salvar produto'); await waitFor(admin,"document.querySelector('tbody').innerText.includes('Produto para excluir')");
    await evaluate(admin,"[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('Produto para excluir')).querySelector('button').click()"); await click(admin,'Excluir produto'); await click(admin,'Confirmar exclusão'); await waitFor(admin,"!document.querySelector('tbody').innerText.includes('Produto para excluir')");
    const produtos=await(await fetch(base+'/administracao/produtos')).json(); assert.equal(produtos.find(p=>p.nome==='Bebida cadastrada no teste').setor,'BAR');
    const mesa=await open('mesa',1194); await input(mesa,'#codigo','12345'); await click(mesa,'Acessar atendimento'); await waitFor(mesa,"document.body.innerText.includes('Olá, Cliente fictício') && document.querySelectorAll('.product-card').length===2");
    await waitFor(mesa,"[...document.querySelectorAll('.product-card img')].some(i=>i.src.includes('/assets/cardapio/uploads/') && i.naturalWidth>0)");
    await waitFor(mesa,"![...document.querySelectorAll('button')].find(b=>b.textContent==='Pedir conta').disabled");
    await click(mesa,'Adicionar'); await click(mesa,'Pedir conta'); await waitFor(mesa,"document.body.innerText.includes('Itens no carrinho não entram na conta')"); await click(mesa,'Continuar mesmo assim'); await waitFor(mesa,"document.body.innerText.includes('Solicitar fechamento da comanda?')"); await input(mesa,'#forma-conta','PIX',true); await click(mesa,'Solicitar fechamento'); await waitFor(mesa,"document.querySelector('[data-testid=conta-solicitada]')"); await snapshot(mesa,'sprint4-mesa-fechamento');
    const caixa=await open('caixa'); await waitFor(caixa,"document.querySelectorAll('#comanda-caixa option').length===2"); await input(caixa,'#comanda-caixa','1',true); await waitFor(caixa,"document.body.innerText.includes('99,80')");
    await label(caixa,'Nome','Serviço'); await label(caixa,'Valor','10'); await click(caixa,'Adicionar taxa'); await label(caixa,'Nome','Música'); await label(caixa,'Tipo','FIXA',true); await label(caixa,'Valor','1.11'); await click(caixa,'Adicionar taxa'); await click(caixa,'Emitir pré-conta'); await waitFor(caixa,"document.querySelector('.preconta') && document.querySelector('.preconta').innerText.includes('110,89')");
    assert.equal(await evaluate(caixa,"[...document.querySelectorAll('button')].find(b=>b.textContent==='Confirmar recebimento').disabled"),true);
    await click(caixa,'Chamar garçom para receber'); await waitFor(caixa,"document.body.innerText.includes('Garçom avisado')");
    const garcom=await open('garcom',430); await waitFor(garcom,"document.body.innerText.includes('Levar pré-conta #1')"); await click(garcom,'Marcar como entregue'); await click(garcom,'Confirmar entrega'); await waitFor(garcom,"document.body.innerText.includes('Entrega confirmada')"); await click(garcom,'Informar retorno ao caixa'); await waitFor(garcom,"document.body.innerText.includes('Retorno informado')"); await snapshot(garcom,'sprint4-garcom');
    await waitFor(caixa,"![...document.querySelectorAll('button')].find(b=>b.textContent==='Confirmar recebimento').disabled"); await snapshot(caixa,'sprint4-caixa');
    const p=await(await fetch(base+'/caixa/precontas/1')).json(); const doc=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}}); windows.push(doc); await doc.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(htmlPreconta(p))); const pdf=await doc.webContents.printToPDF({pageSize:'A4',printBackground:true,preferCSSPageSize:true}); assert.equal(pdf.subarray(0,4).toString(),'%PDF'); await writeFile(process.env.SPRINT4_TEST_ARTIFACTS,pdf); if(process.env.DESKTOP_SCREENSHOT_DIR)await writeFile(join(process.env.DESKTOP_SCREENSHOT_DIR,'preconta.pdf'),pdf);
    await click(caixa,'Confirmar recebimento'); await evaluate(caixa,"document.querySelector('input[type=checkbox]').click()"); await click(caixa,'Confirmar quitação'); await waitFor(caixa,"document.body.innerText.includes('Pagamento registrado #1') && document.body.innerText.includes('Mesa liberada para novo atendimento')"); await snapshot(caixa,'sprint4-pagamento');
    assert.equal(await evaluate(caixa,"document.querySelector('#historico-pagamentos')===null"),true);
    await click(caixa,'Mostrar histórico'); await waitFor(caixa,"document.querySelector('.historico-resumo')"); assert.equal(await evaluate(caixa,"document.querySelector('.historico-detalhe')===null"),true);
    await evaluate(caixa,"document.querySelector('.historico-resumo').click()"); await waitFor(caixa,"document.querySelector('.historico-detalhe')?.innerText.includes('Prato teste')");
    await evaluate(caixa,"document.querySelector('.historico').scrollIntoView()"); await snapshot(caixa,'sprint4-historico'); await click(caixa,'Ocultar histórico');
    await waitFor(mesa,"document.body.innerText.includes('Identificar comanda')"); await waitFor(garcom,"document.body.innerText.includes('Nenhuma conta solicitada')");
    caixa.setContentSize(760,1000); await snapshot(caixa,'sprint4-caixa-760');
    console.log('Electron: cadastro, foto, edição, exclusão, histórico recolhido, carrinho descartado, fechamento, taxas, PDF, aviso, entrega, recebimento e revogação confirmados.');
  }catch(e){console.error(e);for(const w of windows){console.error(w.webContents.getURL(),await evaluate(w,'document.body.innerText'));}code=1;}finally{for(const w of windows)w.destroy();app.exit(code);}
});



