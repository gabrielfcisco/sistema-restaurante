import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import mariadb from 'mariadb';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/src/generated/prisma/client';
import { PrismaOperacaoService } from '../apps/api/src/modules/operacao/service';
import { createApp } from '../apps/api/src/app';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { ItemFilaDto } from '@restaurante/contracts';
test('MySQL US-12/13: isolamento, chegada, transições concorrentes, agregado e rollback', { skip: process.env.RUN_MYSQL_TESTS !== '1' }, async () => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Informe TEST_DATABASE_URL explicitamente para o banco local de testes.');
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const database = 'operacao_test_' + randomBytes(8).toString('hex');
  assert.match(database, /^operacao_test_[a-f0-9]{16}$/);
  const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), multipleStatements: true });
  let created = false, db: PrismaClient | undefined;
  try {
    await connection.query('CREATE DATABASE ' + database); created = true;
    await connection.query('USE ' + database);
    const directory = 'apps/api/prisma/migrations';
    for (const name of (await readdir(directory, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort())
      await connection.query(await readFile(directory + '/' + name + '/migration.sql', 'utf8'));
    url.pathname = '/' + database;
    db = new PrismaClient({ adapter: new PrismaMariaDb(url.toString()) });
    const client = db, service = new PrismaOperacaoService(() => client);
    const cliente = await db.cliente.create({ data: { nome: 'Cliente Fictício', cpf: '12345678909', telefone: '(11) 00000-0000' } });
    const mesa = await db.mesa.create({ data: { numero: 8, status: 'OCUPADA' } });
    const comanda = await db.comanda.create({ data: { idCliente: cliente.idCliente, idMesa: mesa.idMesa } });
    const food = await db.produto.create({ data: { nome: 'Prato Fictício', preco: 30, categoria: 'PRATO', setor: 'COZINHA' } });
    const drink = await db.produto.create({ data: { nome: 'Bebida Fictícia', preco: 8, categoria: 'BEBIDA', setor: 'BAR' } });
    const newOrder = await db.pedido.create({ data: { idComanda: comanda.idComanda, dataHora: new Date('2026-10-22T13:00:00Z') } });
    const oldOrder = await db.pedido.create({ data: { idComanda: comanda.idComanda, dataHora: new Date('2026-10-22T12:00:00Z') } });
    const foodNew = await db.itemPedido.create({ data: { idPedido: newOrder.idPedido, idProduto: food.idProduto, quantidade: 2, observacao: 'Sem sal' } });
    const foodOld = await db.itemPedido.create({ data: { idPedido: oldOrder.idPedido, idProduto: food.idProduto, quantidade: 1, status: 'PENDENTE' } });
    const drinkNew = await db.itemPedido.create({ data: { idPedido: newOrder.idPedido, idProduto: drink.idProduto, quantidade: 2 } });
    await db.itemPedido.create({ data: { idPedido: oldOrder.idPedido, idProduto: food.idProduto, quantidade: 1, status: 'ENTREGUE' } });
    assert.equal(foodNew.status, 'RECEBIDO');
    assert.equal(newOrder.status, 'RECEBIDO');
    const kitchen = await service.listar('COZINHA'), bar = await service.listar('BAR');
    assert.deepEqual(kitchen.map(i => i.idItem), [foodOld.idItem, foodNew.idItem]);
    assert.equal(kitchen[0].status, 'RECEBIDO'); assert.equal(kitchen[0].numeroMesa, 8);
    assert.equal(kitchen[0].dataHora, '2026-10-22T12:00:00.000Z');
    assert.equal(kitchen[0].idComanda, comanda.idComanda); assert.equal(kitchen[1].observacao, 'Sem sal');
    assert.equal(bar.length, 1); assert.equal(bar[0].idItem, drinkNew.idItem);
    assert.doesNotMatch(JSON.stringify(kitchen), /cpf|telefone|nomeCliente|Bebida/);
    await assert.rejects(service.avancar('BAR', foodNew.idItem, { statusAtual: 'RECEBIDO', status: 'EM_PREPARO' }), { code: 'ITEM_INEXISTENTE' });
    await assert.rejects(service.avancar('COZINHA', foodNew.idItem, { statusAtual: 'RECEBIDO', status: 'PRONTO' }), { code: 'TRANSICAO_INVALIDA' });
    const results = await Promise.allSettled([1, 2].map(() => service.avancar('COZINHA', foodNew.idItem, { statusAtual: 'RECEBIDO', status: 'EM_PREPARO' })));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
    assert.equal((await db.pedido.findUniqueOrThrow({ where: { idPedido: newOrder.idPedido } })).status, 'RECEBIDO');
    await service.avancar('BAR', drinkNew.idItem, { statusAtual: 'RECEBIDO', status: 'EM_PREPARO' });
    assert.equal((await db.pedido.findUniqueOrThrow({ where: { idPedido: newOrder.idPedido } })).status, 'EM_PREPARO');
    await Promise.all([
      service.avancar('BAR', drinkNew.idItem, { statusAtual: 'EM_PREPARO', status: 'PRONTO' }),
      service.avancar('COZINHA', foodNew.idItem, { statusAtual: 'EM_PREPARO', status: 'PRONTO' })
    ]);
    assert.equal((await db.pedido.findUniqueOrThrow({ where: { idPedido: newOrder.idPedido } })).status, 'PRONTO');
    assert.ok((await service.listar('COZINHA')).some(i => i.idItem === foodNew.idItem && i.status === 'PRONTO'));
    await service.avancar('COZINHA', foodNew.idItem, { statusAtual: 'PRONTO', status: 'ENTREGUE' });
    assert.equal((await service.listar('COZINHA')).some(i => i.idItem === foodNew.idItem), false);
    assert.equal((await db.pedido.findUniqueOrThrow({ where: { idPedido: newOrder.idPedido } })).status, 'PRONTO');
    await service.avancar('BAR', drinkNew.idItem, { statusAtual: 'PRONTO', status: 'ENTREGUE' });
    assert.equal((await db.pedido.findUniqueOrThrow({ where: { idPedido: newOrder.idPedido } })).status, 'ENTREGUE');
    await assert.rejects(service.avancar('BAR', drinkNew.idItem, { statusAtual: 'RECEBIDO', status: 'EM_PREPARO' }), { code: 'ITEM_ALTERADO' });
    assert.equal((await service.listar('BAR')).length, 0);
    // Falha depois de alterar o item: status do item também deve ser revertido.
    await connection.query("CREATE TRIGGER falhar_agregado BEFORE UPDATE ON pedido FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falha ficticia'");
    await assert.rejects(service.avancar('COZINHA', foodOld.idItem, { statusAtual: 'RECEBIDO', status: 'EM_PREPARO' }));
    await connection.query('DROP TRIGGER falhar_agregado');
    assert.equal((await db.itemPedido.findUniqueOrThrow({ where: { idItem: foodOld.idItem } })).status, 'PENDENTE');
    await db.comanda.update({ where: { idComanda: comanda.idComanda }, data: { status: 'FECHADA', dataFechamento: new Date() } });
    assert.equal((await service.listar('COZINHA')).length, 0);
    await assert.rejects(service.avancar('COZINHA', foodOld.idItem, { statusAtual: 'RECEBIDO', status: 'EM_PREPARO' }), { code: 'ATENDIMENTO_ENCERRADO' });
    assert.equal(await db.itemPedido.count(), 4);
    // Contrato com US-11: um produtor persiste um novo pedido enquanto os dois
    // painéis estão conectados. O backend real distribui somente as novas linhas.
    const server = createApp(async () => {}, { operacao: service, filaIntervalMs: 30 }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api';
    const abort = new AbortController();
    const streams: ReadableStreamDefaultReader<Uint8Array>[] = [];
    async function connect(setor: string) {
      const response = await fetch(base + '/' + setor + '/eventos', { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]) });
      assert.equal(response.status, 200);
      const reader = response.body!.getReader(), decoder = new TextDecoder();
      streams.push(reader);
      let buffer = '';
      return async (): Promise<ItemFilaDto[]> => {
        for (;;) {
          let boundary: number;
          while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            if (frame.includes('event: fila')) return JSON.parse(frame.split('\n').find(l => l.startsWith('data: '))!.slice(6)).itens;
          }
          const data = await reader.read(); assert.equal(data.done, false);
          buffer += decoder.decode(data.value, { stream: true });
        }
      };
    }
    try {
      const nextKitchen = await connect('cozinha'), nextBar = await connect('bar');
      assert.deepEqual(await nextKitchen(), []); assert.deepEqual(await nextBar(), []);
      const atendimento = await db.comanda.create({ data: { idCliente: cliente.idCliente, idMesa: mesa.idMesa } });
      const received = await db.pedido.create({ data: { idComanda: atendimento.idComanda, dataHora: new Date(),
        itens: { create: [{ idProduto: food.idProduto, quantidade: 1 }, { idProduto: drink.idProduto, quantidade: 2 }] } }, include: { itens: true } });
      const receivedKitchen = await nextKitchen(), receivedBar = await nextBar();
      assert.equal(receivedKitchen.length, 1); assert.equal(receivedBar.length, 1);
      assert.equal(receivedKitchen[0].idPedido, received.idPedido); assert.equal(receivedBar[0].idPedido, received.idPedido);
      assert.equal(receivedKitchen[0].setor, 'COZINHA'); assert.equal(receivedBar[0].setor, 'BAR');
      assert.equal(receivedKitchen[0].nomeProduto, food.nome); assert.equal(receivedBar[0].nomeProduto, drink.nome);
      const patch = await fetch(base + '/cozinha/itens/' + receivedKitchen[0].idItem + '/status', { method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statusAtual: 'RECEBIDO', status: 'EM_PREPARO' }) });
      assert.equal(patch.status, 200);
      const updatedKitchen = await nextKitchen();
      assert.equal(updatedKitchen.length, 1); assert.equal(updatedKitchen[0].status, 'EM_PREPARO');
      assert.equal((await service.listar('BAR'))[0].status, 'RECEBIDO');
      assert.equal((await db.pedido.findUniqueOrThrow({ where: { idPedido: received.idPedido } })).status, 'RECEBIDO');
    } finally {
      abort.abort();
      await Promise.all(streams.map(reader => reader.cancel().catch(() => {})));
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  } finally {
    await db?.$disconnect();
    if (created) await connection.query('DROP DATABASE ' + database);
    await connection.end();
  }
});
