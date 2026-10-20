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

