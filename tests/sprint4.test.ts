import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createApp } from '../apps/api/src/app';
import { diretorioImagens, validarImagem } from '../apps/api/src/imagens';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calcularTaxas, formaPagamento, valorMonetario } from '../apps/api/src/modules/caixa/service';
import { allowedRequest, desktopRequest } from '../packages/desktop/src/transport.mjs';
import { htmlPreconta } from '../apps/caixa/electron/documento.mjs';
import { createApiClient } from '@restaurante/api-client';

test('taxas: arredonda cada linha, sem taxa sobre taxa, sem valores implícitos', () => {
  assert.deepEqual(calcularTaxas(0.05, [{ nome: 'Serviço', tipo: 'PERCENTUAL', valor: 10 }, { nome: 'Música', tipo: 'PERCENTUAL', valor: 10 }, { nome: 'Fixa', tipo: 'FIXA', valor: 2.10 }]), {
    taxas: [{ nome: 'Serviço', tipo: 'PERCENTUAL', valor: 10, total: 0.01 }, { nome: 'Música', tipo: 'PERCENTUAL', valor: 10, total: 0.01 }, { nome: 'Fixa', tipo: 'FIXA', valor: 2.1, total: 2.1 }], total: 2.17
  });
  assert.deepEqual(calcularTaxas(12.35, []), { taxas: [], total: 12.35 });
  for (const value of [-1, NaN, Infinity, 0.001, 100000000, '10', null]) assert.throws(() => valorMonetario(value));
  assert.throws(() => calcularTaxas(100, [{ nome: 'Taxa', tipo: 'PERCENTUAL', valor: 100.01 }]));
  assert.throws(() => calcularTaxas(99999999.99, [{ nome: 'Fixa', tipo: 'FIXA', valor: 0.01 }]));
  assert.throws(() => calcularTaxas(100, [{ nome: ' ', tipo: 'FIXA', valor: 1 }]));
  assert.throws(() => formaPagamento('BOLETO'));
});
test('mesa encaminha fechamento somente com sessão; contratos não aceitam total do cliente', async () => {
  assert.equal(allowedRequest('mesa', { path: '/atendimentos/1/solicitar-fechamento', method: 'POST' }), true);
  assert.equal(allowedRequest('mesa', { path: '/atendimentos/1/fechamento', method: 'GET' }), true);
  assert.equal(allowedRequest('mesa', { path: '/caixa/comandas/1/pagamento', method: 'POST' }), false);
  assert.equal((await desktopRequest('mesa', { apiUrl: 'http://127.0.0.1:1/api', token: 'instalacao' }, { path: '/atendimentos/1/solicitar-fechamento', method: 'POST' })).status, 401);
  const requests: unknown[] = [];
  const api = createApiClient('', async req => { requests.push(req); return { status: 200, data: {} }; });
  await api.solicitarFechamento(3, 'token-sessao', 'PIX'); await api.pagar(3, 4);
  assert.deepEqual(requests, [{ path: '/atendimentos/3/solicitar-fechamento', method: 'POST', body: { formaPagamento: 'PIX' }, sessionToken: 'token-sessao', idempotencyKey: undefined }, { path: '/caixa/comandas/3/pagamento', method: 'POST', body: { idPreconta: 4 }, sessionToken: undefined, idempotencyKey: undefined }]);
});
test('documento preserva centavos e escapa nomes sem executar conteúdo do cadastro', () => {
  const html = htmlPreconta({ idPreconta: 2, idComanda: 3, numeroMesa: 8, nomeCliente: '<script>alert(1)</script>', criadaEm: '2026-11-25T12:00:00Z', formaPagamento: 'PIX', itens: [{ nomeProduto: '<img src=x>', quantidade: 1, precoUnitario: 0.05, subtotal: 0.05 }], subtotal: 0.05, taxas: [{ nome: 'Serviço', tipo: 'PERCENTUAL', valor: 10, total: 0.01 }], total: 0.06 });
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('&lt;img src=x&gt;')); assert.ok(html.includes('0,06')); assert.ok(html.includes('Não comprova pagamento'));
  assert.doesNotMatch(html, /<script>|<img/);
});


test('foto: upload limitado, caminho relativo, leitura pela API e rejeição de arquivo inválido', async () => {
  const server = createApp(async () => {}).listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api'; let path: string | undefined;
  try {
    const foto = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
    const r = await fetch(base + '/administracao/imagens', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: foto });
    assert.equal(r.status, 201); path = (await r.json()).imagemPath;
    assert.match(path!, /^cardapio\/uploads\/[0-9a-f-]{36}\.png$/); assert.equal(await validarImagem(path), path);
    const imagem = await fetch(base + '/assets/' + path); assert.equal(imagem.status, 200); assert.equal(imagem.headers.get('x-content-type-options'), 'nosniff'); assert.deepEqual(Buffer.from(await imagem.arrayBuffer()), foto);
    for (const type of ['image/png', 'image/svg+xml', 'application/json']) {
      const r = await fetch(base + '/administracao/imagens', { method: 'POST', headers: { 'Content-Type': type }, body: type === 'application/json' ? '{}' : '<svg>não é uma foto</svg>' }); assert.equal(r.status, 400);
    }
    assert.equal((await fetch(base + '/administracao/imagens', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: Buffer.alloc(5 * 1024 * 1024 + 1) })).status, 413);
    for (const value of ['../.env', 'C:/foto.png', 'https://example.com/a.png', 12, 'cardapio/uploads/00000000-0000-0000-0000-000000000000.png']) await assert.rejects(validarImagem(value));
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); if (path) await unlink(join(diretorioImagens, path.slice('cardapio/'.length))); }
});
