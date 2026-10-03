import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../apps/api/src/app';
import { cpf, codigo, nome, id, chave, ErroApi } from '../apps/api/src/modules/validacao';
import type { SprintService } from '../apps/api/src/modules/sprint-service';

const recepcaoToken = 'recepcao-ficticia-para-testes-000000';
const deviceToken = 'tablet-ficticio-para-testes-00000000';
const access = { recepcaoToken, dispositivos: [{ token: deviceToken, idMesa: 8 }], sessionSeconds: 600 };
async function http(run: (url: string) => Promise<void>, service: Partial<SprintService> = {}) {
  const server = createApp(async () => {}, { service: service as SprintService, access }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`); }
  finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
function post(url: string, body: unknown, token = recepcaoToken, extra = {}) {
  return fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) });
}
test('validação runtime: CPF com dígitos verificadores, nome, código físico, IDs e chave', () => {
  // CPF sintético gerado para testes, sem vínculo com pessoa real.
  assert.equal(cpf('123.456.789-09'), '12345678909');
  for (const value of ['11111111111', '12345678900', 'abc12345678909', null, 12345678909]) assert.throws(() => cpf(value), ErroApi);
  assert.equal(codigo('01234'), '01234');
  for (const value of ['1234', '123456', '12a45', 12345]) assert.throws(() => codigo(value), ErroApi);
  assert.equal(nome(' Cliente fictício '), 'Cliente fictício');
  assert.throws(() => nome(' '), ErroApi);
  for (const value of [0, -1, 1.5, '1', 4294967296]) assert.throws(() => id(value), ErroApi);
  assert.throws(() => chave(''), ErroApi);
});
test('rotas da recepção exigem credencial e validam corpo antes de persistir', async () => {
  await http(async url => {
    assert.equal((await fetch(url + '/mesas')).status, 401);
    assert.equal((await post(url + '/clientes', { nome: 'Teste', cpf: '11111111111' })).status, 400);
    assert.equal((await post(url + '/clientes/busca', null)).status, 400);
    assert.equal((await fetch(url + '/mesas/1.5', { headers: { Authorization: `Bearer ${recepcaoToken}` } })).status, 400);
    assert.equal((await post(url + '/atendimentos', { idCliente: 1, idMesa: 8, codigoCartao: '58324' })).status, 400);
    assert.equal((await post(url + '/atendimentos', { idCliente: 1, idMesa: 8, codigoCartao: '58324', confirmarMesaOcupada: 'true' })).status, 400);
  });
});
test('busca normaliza CPF e erros de negócio preservam código sem vazar internos', async () => {
  await http(async url => {
    const found = await post(url + '/clientes/busca', { cpf: '123.456.789-09' });
    assert.equal(found.status, 200);
    assert.equal((await found.json()).idCliente, 1);
    const duplicate = await post(url + '/clientes', { nome: 'Teste', cpf: '12345678909', telefone: '(11) 00000-0000' });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, 'CPF_DUPLICADO');
  }, {
    buscarCliente: async value => { assert.equal(value, '12345678909'); return { idCliente: 1, nome: 'Teste', cpf: value, telefone: '(11) 00000-0000' }; },
    criarCliente: async () => { throw new ErroApi(409, 'CPF_DUPLICADO', 'CPF já cadastrado.'); }
  });
});
test('cadastro exige telefone e repassa o valor preenchido ao serviço', async () => {
  let calls = 0;
  await http(async url => {
    for (const telefone of [undefined, null, '', '   ', 11000000000, '1'.repeat(33)]) {
      const response = await post(url + '/clientes', { nome: 'Cliente fictício', cpf: '12345678909', telefone });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'TELEFONE_INVALIDO');
    }
    assert.equal(calls, 0);
    const response = await post(url + '/clientes', { nome: 'Cliente fictício', cpf: '12345678909', telefone: ' (11) 00000-0000 ' });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).telefone, '(11) 00000-0000');
    assert.equal(calls, 1);
  }, { criarCliente: async input => {
    calls++;
    assert.equal(input.telefone, '(11) 00000-0000');
    return { idCliente: 1, ...input };
  } });
});
test('acesso usa mesa da credencial, retorna identificação e bloqueia troca de mesa no corpo', async () => {
  let calls = 0;
  await http(async url => {
    assert.equal((await post(url + '/acessos/mesa', { codigoCartao: '58324', idMesa: 9 }, deviceToken)).status, 403);
    assert.equal(calls, 0);
    const response = await post(url + '/acessos/mesa', { codigoCartao: '58324' }, deviceToken);
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.numeroMesa, 8);
    assert.equal(body.nomeCliente, 'Cliente teste');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await post(url + '/acessos/mesa', { codigoCartao: '58324' }, recepcaoToken)).status, 401);
    for (let i = 0; i < 8; i++) await post(url + '/acessos/mesa', { codigoCartao: '58324' }, deviceToken);
    const limited = await post(url + '/acessos/mesa', { codigoCartao: '58324' }, deviceToken);
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('retry-after'));
  }, { acessar: async (code, mesa) => {
    calls++; assert.equal(mesa, 8); assert.equal(code, '58324');
    return { token: 'sessao', expiraEm: new Date().toISOString(), idComanda: 1, codigoCartao: code, idMesa: mesa, numeroMesa: 8, nomeCliente: 'Cliente teste' };
  } });
});
test('logout responde 204 e erro inesperado não expõe segredo', async () => {
  await http(async url => {
    assert.equal((await fetch(url + '/acessos/mesa', { method: 'DELETE', headers: { Authorization: 'Bearer sessao' } })).status, 204);
    const response = await fetch(url + '/mesas', { headers: { Authorization: `Bearer ${recepcaoToken}` } });
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /segredo/);
  }, { sair: async token => { assert.equal(token, 'sessao'); }, listarMesas: async () => { throw new Error('segredo'); } });
});
