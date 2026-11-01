import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { allowedRequest, readDesktopConfig, desktopRequest } from '../packages/desktop/src/transport.mjs';
import { ApiError, createApiClient } from '@restaurante/api-client';
test('bridge limita operações por aplicativo e recusa URLs/caminhos arbitrários', async () => {
  assert.equal(allowedRequest('mesa', { path: '/clientes', method: 'POST' }), false);
  assert.equal(allowedRequest('recepcao', { path: '//externo.invalid', method: 'GET' }), false);
  assert.equal(allowedRequest('recepcao', { path: '/mesas/1/../clientes', method: 'GET' }), false);
  assert.equal(allowedRequest('mesa', { path: '/acessos/mesa', method: 'POST' }), true);
  assert.equal(allowedRequest('mesa', { path: '/cardapio/produtos', method: 'GET' }), true);
  assert.equal(allowedRequest('mesa', { path: '/cardapio/produtos?categoria=PRATO', method: 'GET' }), true);
  assert.equal(allowedRequest('mesa', { path: '/atendimentos/1/pedidos', method: 'POST' }), true);
  assert.equal(allowedRequest('recepcao', { path: '/atendimentos/1/pedidos', method: 'POST' }), false);
  assert.equal(allowedRequest('recepcao', { path: '/mesas/1/liberar', method: 'POST' }), true);
  assert.equal((await desktopRequest('mesa', null, { path: '/health', method: 'GET' })).status, 503);
  assert.equal((await desktopRequest('mesa', null, { path: '/clientes', method: 'POST' })).status, 403);
  const root = await mkdtemp(join(tmpdir(), 'restaurante-config-test-'));
  const file = join(root, 'config.json');
  try {
    for (const apiUrl of ['http://externo.invalid/api', 'https://usuario:senha@externo.invalid/api', 'https://externo.invalid/api?token=1', 'file:///api']) {
      await writeFile(file, JSON.stringify({ apiUrl, token: 'ficticio-00000000000000000000000000' }));
      assert.equal(await readDesktopConfig(file), null);
    }
    await writeFile(file, JSON.stringify({ apiUrl: 'http://127.0.0.1:3333/api', token: 'ficticio-00000000000000000000000000' }));
    assert.ok(await readDesktopConfig(file));
  } finally { await unlink(file); await rmdir(root); }
});
test('credencial de instalação fica no transporte; sessão e idempotência são encaminhadas corretamente', async () => {
  const captured: { authorization?: string; key?: string; path?: string }[] = [];
  const server = createServer((req, res) => {
    captured.push({ authorization: req.headers.authorization, key: req.headers['idempotency-key'] as string, path: req.url });
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const config = { apiUrl: 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api', token: 'instalacao-ficticia-000000000000000000' };
  try {
    const response = await desktopRequest('recepcao', config, { path: '/atendimentos', method: 'POST', body: {}, idempotencyKey: 'chave-idempotente-ficticia' });
    assert.equal(response.status, 200);
    const token = 'sessao-ficticia-00000000000000000000';
    await desktopRequest('mesa', config, { path: '/acessos/mesa', method: 'GET', sessionToken: token });
    assert.equal(captured[0].authorization, 'Bearer ' + config.token);
    assert.equal(captured[0].key, 'chave-idempotente-ficticia');
    assert.equal(captured[1].authorization, 'Bearer ' + token);
    assert.doesNotMatch(JSON.stringify(response), new RegExp(config.token));
    assert.equal((await desktopRequest('mesa', config, { path: '/acessos/mesa', method: 'GET' })).status, 401);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('cliente compartilhado preserva chave de retry e converte erros da API', async () => {
  let key = '';
  const api = createApiClient('http://localhost/api', async req => {
    key = req.idempotencyKey ?? '';
    return { status: 409, data: { error: { code: 'CARTAO_EM_USO', message: 'Cartão em uso.' } } };
  });
  await assert.rejects(api.abrir({ idCliente: 1, idMesa: 1, codigoCartao: '01234' }, 'chave-retry-ficticia'), (e: unknown) => e instanceof ApiError && e.code === 'CARTAO_EM_USO' && e.status === 409);
  assert.equal(key, 'chave-retry-ficticia');
});

test('painéis não usam token e o bridge limita cada um ao próprio setor', async () => {
  for (const profile of ['cozinha', 'bar']) {
    const other = profile === 'cozinha' ? 'bar' : 'cozinha';
    assert.equal(allowedRequest(profile, { path: '/' + profile + '/itens', method: 'GET' }), true);
    assert.equal(allowedRequest(profile, { path: '/' + profile + '/itens/1/status', method: 'PATCH' }), true);
    assert.equal(allowedRequest(profile, { path: '/' + other + '/itens', method: 'GET' }), false);
    assert.equal(allowedRequest(profile, { path: '/acessos/mesa', method: 'POST' }), false);
  }
  assert.equal(allowedRequest('perfil-inventado', { path: '/acessos/mesa', method: 'POST' }), false);
  const root = await mkdtemp(join(tmpdir(), 'restaurante-panel-config-')), file = join(root, 'config.json');
  try {
    await writeFile(file, JSON.stringify({ apiUrl: 'http://192.168.1.50:3333/api' }));
    assert.ok(await readDesktopConfig(file, 'cozinha'));
    assert.equal(await readDesktopConfig(file, 'mesa'), null);
    await writeFile(file, JSON.stringify({ apiUrl: 'http://8.8.8.8/api' }));
    assert.equal(await readDesktopConfig(file, 'bar'), null);
  } finally { await unlink(file); await rmdir(root); }
  const server = createServer((req, res) => {
    assert.equal(req.headers.authorization, undefined);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('[]');
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await desktopRequest('cozinha', { apiUrl: 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api' }, { path: '/cozinha/itens', method: 'GET' });
    assert.equal(response.status, 200);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

