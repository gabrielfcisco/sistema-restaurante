import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../apps/api/src/app';
import type { CategoriasService } from '../apps/api/src/modules/administracao/service';
import type { GarcomService } from '../apps/api/src/modules/garcom/service';
import type { OperacaoService } from '../apps/api/src/modules/operacao/service';
import { ErroApi } from '../apps/api/src/modules/validacao';

const categorias: CategoriasService = {
  async listar() { return [{ idCategoria: 'PRATO', nome: 'Pratos', ativo: true }]; },
  async criar(nome) { return { idCategoria: 'nova', nome, ativo: true }; },
  async alterar(id, input) { return { idCategoria: id, nome: input.nome ?? 'Pratos', ativo: input.ativo ?? true }; }
};
const garcom: GarcomService = {
  async mesa(value, porNumero) { assert.equal(value, 8); assert.equal(porNumero, true); return { idMesa: 2, numeroMesa: 8, comandas: [] }; },
  async comanda() { throw new ErroApi(409, 'COMANDA_ENCERRADA', 'Comanda encerrada.'); }
};
const operacao: OperacaoService = {
  async listar(setor) { assert.equal(setor, 'GARCOM'); return []; },
  async avancar(setor, id, input) { assert.equal(setor, 'GARCOM'); assert.deepEqual(input, { statusAtual: 'PRONTO', status: 'ENTREGUE' }); return { idItem: id, status: 'ENTREGUE', statusPedido: 'PRONTO' }; }
};
test('Sprint 3 HTTP: validação, consulta sem dados pessoais e contratos de categoria/entrega', async () => {
  const server = createApp(async () => {}, { categorias, garcom, operacao }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api';
  const send = (path: string, method = 'GET', body?: unknown) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  try {
    for (const nome of ['', '   ', 1, null, 'a'.repeat(121)]) assert.equal((await send('/administracao/categorias', 'POST', { nome })).status, 400);
    const created = await send('/administracao/categorias', 'POST', { nome: '  Entradas  ' });
    assert.equal(created.status, 201); assert.equal((await created.json()).nome, 'Entradas');
    for (const body of [{}, { ativo: 'false' }, { nome: null }, { excluir: true }]) assert.equal((await send('/administracao/categorias/PRATO', 'PATCH', body)).status, 400);
    const updated = await send('/administracao/categorias/PRATO', 'PATCH', { ativo: false });
    assert.equal(updated.status, 200); assert.equal((await updated.json()).ativo, false);
    assert.equal((await send('/administracao/categorias')).headers.get('cache-control'), 'no-store');
    assert.equal((await send('/garcom/mesas?numero=abc')).status, 400);
    assert.deepEqual(await (await send('/garcom/mesas?numero=8')).json(), { idMesa: 2, numeroMesa: 8, comandas: [] });
    assert.equal((await send('/garcom/comandas/1')).status, 409);
    assert.deepEqual(await (await send('/garcom/itens-prontos')).json(), []);
    assert.equal((await send('/garcom/itens/1/status', 'PATCH', { statusAtual: 'EM_PREPARO', status: 'ENTREGUE' })).status, 409);
    assert.equal((await send('/garcom/itens/0/status', 'PATCH', { statusAtual: 'PRONTO', status: 'ENTREGUE' })).status, 400);
    assert.equal((await send('/garcom/itens/1/status', 'PATCH', { statusAtual: 'PRONTO', status: 'ENTREGUE' })).status, 200);
    assert.equal((await send('/atendimentos/1/extrato')).status, 401);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
