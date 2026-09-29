import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../apps/api/src/app';

async function withApi(probe: () => Promise<void>, run: (url: string) => Promise<void>) {
  const server = createApp(probe).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  try { await run(`http://127.0.0.1:${address.port}/api`); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test('processo saudável não mascara banco indisponível', async () => {
  await withApi(async () => { throw new Error('credencial secreta'); }, async url => {
    assert.equal((await fetch(url + '/health')).status, 200);
    const response = await fetch(url + '/ready');
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.match(body, /DATABASE_UNAVAILABLE/);
    assert.doesNotMatch(body, /credencial secreta/);
  });
});

test('readiness verifica dependência e rotas inexistentes não simulam negócio', async () => {
  let calls = 0;
  await withApi(async () => { calls++; }, async url => {
    assert.equal((await fetch(url + '/ready')).status, 200);
    assert.equal(calls, 1);
    assert.equal((await fetch(url + '/mesas')).status, 404);
    const invalid = await fetch(url + '/clientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(invalid.status, 400);
  });
});

test('CORS permite apps configurados e não libera origem externa', async () => {
  await withApi(async () => {}, async url => {
    const local = await fetch(url + '/health', { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const external = await fetch(url + '/health', { headers: { Origin: 'https://exemplo.invalid' } });
    assert.equal(external.headers.get('access-control-allow-origin'), null);
  });
});
