import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import mariadb from 'mariadb';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/src/generated/prisma/client';
import { PrismaSprintService } from '../apps/api/src/modules/sprint-service';
import { PrismaOperacaoService } from '../apps/api/src/modules/operacao/service';
import { PrismaGarcomService } from '../apps/api/src/modules/garcom/service';
import { PrismaCategoriasService } from '../apps/api/src/modules/administracao/service';
import { createApp } from '../apps/api/src/app';
import { mysqlTestConfig } from './helpers/mysql';
import type { ItemFilaDto } from '@restaurante/contracts';

test('MySQL Sprint 3: migração preserva catálogo; categorias, concorrência, entrega SSE e consumo real', { skip: process.env.RUN_MYSQL_TESTS !== '1' }, async () => {
  assert.ok(process.env.TEST_DATABASE_URL);
  const url = new URL(process.env.TEST_DATABASE_URL);
  const database = 'sprint03_test_' + randomBytes(8).toString('hex');
  assert.match(database, /^sprint03_test_[a-f0-9]{16}$/);
  const connection = await mariadb.createConnection({ ...mysqlTestConfig(url), multipleStatements: true });
  let created = false, db: PrismaClient | undefined;
  try {
    await connection.query('CREATE DATABASE ' + database); created = true;
    await connection.query('USE ' + database);
    const directory = 'apps/api/prisma/migrations';
    for (const name of (await readdir(directory, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort()) {
      if (name === '20261103000000_categorias') {
        await connection.query("INSERT INTO produto(nome,preco,categoria,setor) VALUES ('Prato legado',0.10,'PRATO','COZINHA'),('Bebida legada',12.35,'BEBIDA','BAR'),('Sobremesa legada',5,'SOBREMESA','COZINHA')");
      }
      await connection.query(await readFile(directory + '/' + name + '/migration.sql', 'utf8'));
    }
    url.pathname = '/' + database;
    db = new PrismaClient({ adapter: new PrismaMariaDb(mysqlTestConfig(url, true)) });
    const client = db;
    const sprint = new PrismaSprintService(() => client, 600), operacao = new PrismaOperacaoService(() => client);
    const garcom = new PrismaGarcomService(() => client), categorias = new PrismaCategoriasService(() => client);
    assert.equal(await db.produto.count(), 3);
    assert.deepEqual((await db.produto.findMany({ orderBy: { idProduto: 'asc' }, include: { grupo: true } })).map(p => p.grupo.idCategoria), ['PRATO', 'BEBIDA', 'SOBREMESA']);
    const usuario = await sprint.criarCliente({ nome: 'Cliente fictício', cpf: '12345678909', telefone: '0000000000' });
    const mesa = await db.mesa.create({ data: { numero: 8 } });
    const livre = await db.mesa.create({ data: { numero: 9 } });
    const a = await sprint.abrir({ idMesa: mesa.idMesa, idCliente: usuario.idCliente, codigoCartao: '12345' }, 'sprint03-abertura-0001');
    const b = await sprint.abrir({ idMesa: mesa.idMesa, idCliente: usuario.idCliente, codigoCartao: '12346', confirmarMesaOcupada: true }, 'sprint03-abertura-0002');
    const sessao = await sprint.acessar('12345', mesa.idMesa);
    assert.equal((await garcom.mesa(8, true)).comandas.length, 2);
    assert.equal((await garcom.mesa(livre.idMesa)).comandas.length, 0);
    await assert.rejects(garcom.mesa(999), { code: 'MESA_INEXISTENTE' });
    assert.doesNotMatch(JSON.stringify(await garcom.mesa(mesa.idMesa)), /cpf|telefone|nomeCliente|codigoCartao/);
    assert.equal((await garcom.comanda(b.dto.idComanda)).total, 0);
    const novo = await categorias.criar('  Entradas  ');
    assert.equal(novo.nome, 'Entradas');
    await assert.rejects(categorias.criar('entradas'), { code: 'CATEGORIA_DUPLICADA' });
    await assert.rejects(categorias.alterar('PRATO', { nome: 'ENTRADAS' }), { code: 'CATEGORIA_DUPLICADA' });
    const concorrentes = await Promise.allSettled([categorias.criar('Especiais'), categorias.criar('ESPECIAIS')]);
    assert.equal(concorrentes.filter(r => r.status === 'fulfilled').length, 1);
    await categorias.alterar(novo.idCategoria, { nome: 'Entradas da casa' });
    assert.ok((await sprint.categoriasDetalhadas(sessao.token)).some(c => c.nome === 'Entradas da casa'));
    const p1 = await sprint.confirmarPedido(a.dto.idComanda, { itens: [{ idProduto: 1, quantidade: 3 }, { idProduto: 2, quantidade: 2 }] }, sessao.token, 'sprint03-pedido-00001');
    const p2 = await sprint.confirmarPedido(a.dto.idComanda, { itens: [{ idProduto: 3, quantidade: 1 }] }, sessao.token, 'sprint03-pedido-00002');
    assert.equal((await garcom.comanda(a.dto.idComanda)).total, 30);
    assert.equal((await garcom.comanda(a.dto.idComanda)).pedidos.length, 2);
    await categorias.alterar('PRATO', { nome: 'Pratos da casa', ativo: false });
    assert.ok(!(await sprint.produtosCardapio(sessao.token)).some(p => p.idProduto === 1));
    assert.equal((await sprint.detalheProduto(sessao.token, 1)).disponivel, false);
    await assert.rejects(sprint.confirmarPedido(a.dto.idComanda, { itens: [{ idProduto: 1, quantidade: 1 }] }, sessao.token, 'sprint03-pedido-00003'), { code: 'PRODUTO_INDISPONIVEL' });
    assert.equal(await db.pedido.count(), 2);
    assert.equal((await garcom.comanda(a.dto.idComanda)).total, 30);
    await categorias.alterar('PRATO', { ativo: true });
    assert.equal((await sprint.detalheProduto(sessao.token, 1)).nomeCategoria, 'Pratos da casa');
    const item = p1.dto.itens[0], bebida = p1.dto.itens[1];
    await assert.rejects(operacao.avancar('GARCOM', item.idItem, { statusAtual: 'RECEBIDO', status: 'ENTREGUE' }), { code: 'TRANSICAO_INVALIDA' });
    for (const i of [item, bebida]) {
      await operacao.avancar(i.setor, i.idItem, { statusAtual: 'RECEBIDO', status: 'EM_PREPARO' });
      await operacao.avancar(i.setor, i.idItem, { statusAtual: 'EM_PREPARO', status: 'PRONTO' });
    }
    assert.deepEqual((await operacao.listar('GARCOM')).map(i => i.idItem), [item.idItem, bebida.idItem]);
    const server = createApp(async () => {}, { service: sprint, operacao, categorias, garcom, filaIntervalMs: 30 }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api';
    const controller = new AbortController();
    const response = await fetch(base + '/garcom/eventos', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
    const reader = response.body!.getReader(); const decoder = new TextDecoder(); let buffer = '';
    async function snapshot(): Promise<ItemFilaDto[]> {
      for (;;) {
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          if (frame.includes('event: fila')) return JSON.parse(frame.split('\n').find(l => l.startsWith('data: '))!.slice(6)).itens;
        }
        const data = await reader.read(); assert.equal(data.done, false); buffer += decoder.decode(data.value, { stream: true });
      }
    }
    try {
      assert.equal((await snapshot()).length, 2);
      const entregar = () => fetch(base + '/garcom/itens/' + item.idItem + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statusAtual: 'PRONTO', status: 'ENTREGUE' }) });
      const results = await Promise.all([entregar(), entregar()]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
      assert.deepEqual((await snapshot()).map(i => i.idItem), [bebida.idItem]);
      assert.equal((await db.pedido.findUniqueOrThrow({ where: { idPedido: p1.dto.idPedido } })).status, 'PRONTO');
      await operacao.avancar('GARCOM', bebida.idItem, { statusAtual: 'PRONTO', status: 'ENTREGUE' });
      assert.equal((await snapshot()).length, 0);
      assert.equal((await db.pedido.findUniqueOrThrow({ where: { idPedido: p1.dto.idPedido } })).status, 'ENTREGUE');
      assert.equal((await garcom.comanda(a.dto.idComanda)).total, 30);
      assert.equal((await db.itemPedido.findUniqueOrThrow({ where: { idItem: p2.dto.itens[0].idItem } })).status, 'RECEBIDO');
    } finally { controller.abort(); await reader.cancel().catch(() => {}); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
    await sprint.liberar(mesa.idMesa);
    assert.equal((await garcom.mesa(mesa.idMesa)).comandas.length, 0);
    await assert.rejects(garcom.comanda(a.dto.idComanda), { code: 'COMANDA_ENCERRADA' });
    assert.equal(await db.itemPedido.count(), 3);
  } finally {
    await db?.$disconnect();
    if (created) await connection.query('DROP DATABASE ' + database);
    await connection.end();
  }
});
