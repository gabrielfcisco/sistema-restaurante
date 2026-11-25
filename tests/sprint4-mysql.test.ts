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
import { PrismaProdutosService } from '../apps/api/src/modules/administracao/produtos';
import { PrismaCaixaService } from '../apps/api/src/modules/caixa/service';
import { createApp } from '../apps/api/src/app';
import { mysqlTestConfig } from './helpers/mysql';

test('MySQL Sprint 4: produtos, fechamento, pré-contas, pagamento atômico e múltiplas comandas', { skip: process.env.RUN_MYSQL_TESTS !== '1' }, async t => {
  assert.ok(process.env.TEST_DATABASE_URL);
  const url = new URL(process.env.TEST_DATABASE_URL), database = 'sprint04_test_' + randomBytes(8).toString('hex');
  const connection = await mariadb.createConnection({ ...mysqlTestConfig(url), multipleStatements: true });
  let created = false, db: PrismaClient | undefined;
  try {
    await connection.query('CREATE DATABASE ' + database); created = true; await connection.query('USE ' + database);
    for (const name of (await readdir('apps/api/prisma/migrations', { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort()) await connection.query(await readFile('apps/api/prisma/migrations/' + name + '/migration.sql', 'utf8'));
    url.pathname = '/' + database; db = new PrismaClient({ adapter: new PrismaMariaDb(mysqlTestConfig(url, true)) }); const client = db;
    const sprint = new PrismaSprintService(() => client, 600), caixa = new PrismaCaixaService(() => client), produtos = new PrismaProdutosService(() => client), operacao = new PrismaOperacaoService(() => client);
    const cliente = await sprint.criarCliente({ nome: 'Cliente fictício', cpf: '12345678909', telefone: '0000000000' });
    const mesa = await db.mesa.create({ data: { numero: 8 } });
    let seq = 10000;
    async function abrir() { const codigo = String(seq++); const a = await sprint.abrir({ idMesa: mesa.idMesa, idCliente: cliente.idCliente, codigoCartao: codigo, confirmarMesaOcupada: true }, 'sprint04-abertura-' + codigo); return { id: a.dto.idComanda, s: await sprint.acessar(codigo, mesa.idMesa) }; }
    const a = await abrir(), b = await abrir();
    const produto = await produtos.criar({ nome: 'Prato', descricao: 'Descrição', preco: 0.05, categoria: 'PRATO', setor: 'COZINHA', ativo: true });
    const bebida = await produtos.criar({ nome: 'Bebida', descricao: null, preco: 12.35, categoria: 'BEBIDA', setor: 'BAR', ativo: true });
    const novoPedido = (id: number, token: string, idProduto = produto.idProduto) => sprint.confirmarPedido(id, { itens: [{ idProduto, quantidade: 1 }] }, token, 'pedido-sprint04-' + randomBytes(8).toString('hex'));
    await t.test('cadastro valida campos, categorias e disponibilidade; pedido misto segue o setor real', async () => {
      for (const patch of [{ preco: -1 }, { preco: 0.001 }, { categoria: 'inexistente' }, { setor: 'CAIXA' }, { ativo: 'sim' }, { nome: '' }]) await assert.rejects(produtos.criar({ nome: 'Inválido', preco: 1, categoria: 'PRATO', setor: 'BAR', ativo: true, ...patch }));
      const oculto = await produtos.criar({ nome: 'Inativo', preco: 1, categoria: 'PRATO', setor: 'BAR', ativo: false });
      assert.ok(!(await sprint.produtosCardapio(a.s.token)).some(p => p.idProduto === oculto.idProduto));
      const misto = await sprint.confirmarPedido(a.id, { itens: [{ idProduto: produto.idProduto, quantidade: 1 }, { idProduto: bebida.idProduto, quantidade: 1 }] }, a.s.token, 'sprint04-pedido-misto');
      assert.deepEqual(misto.dto.itens.map(i => i.setor), ['COZINHA', 'BAR']);
      await assert.rejects(produtos.setor(produto.idProduto, 'BAR'), { code: 'SETOR_EM_USO' });
      assert.equal((await operacao.listar('BAR'))[0].idItem, misto.dto.itens[1].idItem);
    });
    await t.test('fechamento valida sessão, persiste forma, repete sem duplicar e bloqueia pedidos', async () => {
      await assert.rejects(caixa.solicitar(a.id, b.s.token, 'PIX'), { code: 'COMANDA_INCORRETA' });
      await assert.rejects(caixa.solicitar(a.id, 'ausente', 'PIX'), { code: 'SESSAO_INVALIDA' });
      const r = await caixa.solicitar(a.id, a.s.token, 'PIX'); assert.equal(r.status, 'CONTA_SOLICITADA');
      assert.deepEqual(await caixa.solicitar(a.id, a.s.token, 'PIX'), r);
      await assert.rejects(caixa.solicitar(a.id, a.s.token, 'CREDITO'), { code: 'FECHAMENTO_JA_SOLICITADO' });
      await assert.rejects(novoPedido(a.id, a.s.token), { code: 'PEDIDOS_BLOQUEADOS' });
      assert.equal((await caixa.listar()).length, 1); assert.equal((await caixa.detalhe(a.id)).total, 12.4);
      assert.equal((await caixa.avisos()).solicitacoes.length, 1);
      assert.doesNotMatch(JSON.stringify(await caixa.detalhe(a.id)), /cpf|telefone/);
    });
    await t.test('pré-conta congela valores, controla versões, não quita e avisos sobrevivem outro serviço', async () => {
      const p1 = await caixa.emitir(a.id, []), p2 = await caixa.emitir(a.id, [{ nome: 'Serviço', tipo: 'PERCENTUAL', valor: 10 }, { nome: 'Música', tipo: 'FIXA', valor: 2.1 }]);
      assert.equal(p2.total, 15.74); assert.equal(await db!.pagamento.count(), 0);
      assert.equal((await sprint.sessao(a.s.token)).idComanda, a.id);
      await assert.rejects(caixa.chamar(a.id, p1.idPreconta), { code: 'PRECONTA_DESATUALIZADA' });
      await assert.rejects(caixa.pagar(a.id, p2.idPreconta), { code: 'ITENS_PENDENTES' });
      assert.equal(await db!.pagamento.count(), 0);
      const avisos = await Promise.all([caixa.chamar(a.id, p2.idPreconta), caixa.chamar(a.id, p2.idPreconta)]);
      assert.equal(avisos[0].idCobranca, avisos[1].idCobranca);
      const novo = new PrismaCaixaService(() => client); assert.equal((await novo.avisos()).cobrancas.length, 1);
      await assert.rejects(caixa.emitir(a.id, []), { code: 'COBRANCA_PENDENTE' });
      await novo.concluir(avisos[0].idCobranca); assert.equal(await db!.pagamento.count(), 0);
      assert.equal((await caixa.documentoEmitido(p2.idPreconta)).total, 15.74);
      // Alteração externa de preço torna o documento obsoleto, mesmo com o mesmo ID.
      await db!.produto.update({ where: { idProduto: bebida.idProduto }, data: { preco: 15 } });
      await assert.rejects(caixa.pagar(a.id, p2.idPreconta), { code: 'PRECONTA_DESATUALIZADA' });
      await db!.produto.update({ where: { idProduto: bebida.idProduto }, data: { preco: 12.35 } });
    });
    await t.test('pagamento concorrente único preserva outra comanda, sessões, cartões e histórico', async () => {
      const itens = await db!.itemPedido.findMany({ where: { pedido: { idComanda: a.id } }, include: { produto: true } });
      for (const i of itens) { await operacao.avancar(i.produto.setor, i.idItem, { statusAtual: 'RECEBIDO', status: 'EM_PREPARO' }); await operacao.avancar(i.produto.setor, i.idItem, { statusAtual: 'EM_PREPARO', status: 'PRONTO' }); await operacao.avancar('GARCOM', i.idItem, { statusAtual: 'PRONTO', status: 'ENTREGUE' }); }
      await sprint.criarChamada(a.id, a.s.token);
      const p = (await caixa.detalhe(a.id)).preconta!;
      const resultados = await Promise.allSettled([caixa.pagar(a.id, p.idPreconta), caixa.pagar(a.id, p.idPreconta)]);
      assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal((resultados.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.code, 'PAGAMENTO_DUPLICADO');
      assert.equal(await db!.pagamento.count(), 1); assert.equal((await db!.mesa.findUniqueOrThrow({ where: { idMesa: mesa.idMesa } })).status, 'OCUPADA');
      await assert.rejects(sprint.sessao(a.s.token), { code: 'SESSAO_INVALIDA' }); assert.equal((await sprint.sessao(b.s.token)).idComanda, b.id);
      assert.equal(await db!.vinculoCartao.count({ where: { idComanda: b.id } }), 1); assert.equal(await db!.vinculoCartao.count({ where: { idComanda: a.id } }), 0);
      assert.equal(await db!.chamada.count({ where: { status: 'PENDENTE' } }), 1);
      await caixa.solicitar(b.id, b.s.token, 'DINHEIRO'); const pb = await caixa.emitir(b.id, []);
      assert.equal((await caixa.pagar(b.id, pb.idPreconta)).mesaLiberada, true);
      assert.equal((await sprint.listarMesas())[0].status, 'LIVRE'); assert.equal(await db!.chamada.count({ where: { status: 'CANCELADA' } }), 1);
      assert.equal(await db!.itemPedido.count(), 2); assert.equal((await db!.comanda.findUniqueOrThrow({ where: { idComanda: a.id } })).status, 'PAGA');
      assert.equal((await caixa.listar()).length, 0); assert.equal((await caixa.avisos()).solicitacoes.length, 0);
      await produtos.setor(produto.idProduto, 'BAR');
    });
    await t.test('fechamento versus pedido e setor versus pedido são serializados sem perder itens', async () => {
      const c = await abrir();
      await Promise.allSettled([novoPedido(c.id, c.s.token), caixa.solicitar(c.id, c.s.token, 'DEBITO')]);
      assert.equal((await caixa.fechamento(c.id, c.s.token)).status, 'CONTA_SOLICITADA');
      const count = await db!.pedido.count({ where: { idComanda: c.id } });
      await assert.rejects(novoPedido(c.id, c.s.token), { code: 'PEDIDOS_BLOQUEADOS' });
      assert.equal(await db!.pedido.count({ where: { idComanda: c.id } }), count);
      const d = await abrir(); const p = await produtos.criar({ nome: 'Concorrente', preco: 1, categoria: 'PRATO', setor: 'COZINHA', ativo: true });
      const results = await Promise.allSettled([novoPedido(d.id, d.s.token, p.idProduto), produtos.setor(p.idProduto, 'BAR')]);
      assert.equal(results[0].status, 'fulfilled');
      const setor = (await db!.produto.findUniqueOrThrow({ where: { idProduto: p.idProduto } })).setor;
      if (results[1].status === 'rejected') assert.equal(setor, 'COZINHA'); else assert.equal(setor, 'BAR');
      await assert.rejects(produtos.setor(p.idProduto, setor === 'BAR' ? 'COZINHA' : 'BAR'), { code: 'SETOR_EM_USO' });
    });
    await t.test('HTTP valida sessão/total e SSE reconcilia avisos persistidos', async () => {
      const app = createApp(async () => {}, { service: sprint, operacao, caixa, produtos }); const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
      const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api';
      const controller = new AbortController();
      try {
        assert.equal((await fetch(base + '/atendimentos/1/solicitar-fechamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"formaPagamento":"PIX"}' })).status, 401);
        assert.equal((await fetch(base + '/caixa/comandas/1/pagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"idPreconta":1,"total":0.01}' })).status, 400);
        assert.equal((await fetch(base + '/administracao/produtos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"preco":-1}' })).status, 400);
        const r = await fetch(base + '/garcom/contas/eventos', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) });
        const reader = r.body!.getReader(); let text = ''; const decoder = new TextDecoder();
        while (!text.includes('event: contas')) text += decoder.decode((await reader.read()).value, { stream: true });
        assert.ok(text.includes('solicitacoes')); controller.abort(); await reader.cancel().catch(() => {});
        const antigas = await fetch(base + '/caixa/precontas/1'); assert.equal(antigas.status, 200);
      } finally { controller.abort(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
    });
    await t.test('falha depois de registrar pagamento reverte tudo; últimas comandas concorrentes liberam uma vez', async () => {
      const m = await db!.mesa.create({ data: { numero: 99 } });
      const abrirOutra = async (codigoCartao: string) => { const c = await sprint.abrir({ idMesa: m.idMesa, idCliente: cliente.idCliente, codigoCartao, confirmarMesaOcupada: true }, 'rollback-abertura-' + codigoCartao); return { id: c.dto.idComanda, s: await sprint.acessar(codigoCartao, m.idMesa) }; };
      const x = await abrirOutra('20001'), y = await abrirOutra('20002');
      for (const c of [x, y]) await caixa.solicitar(c.id, c.s.token, 'CREDITO');
      const px = await caixa.emitir(x.id, []), py = await caixa.emitir(y.id, []);
      await connection.query("CREATE TRIGGER falha_quitacao BEFORE UPDATE ON comanda FOR EACH ROW BEGIN IF NEW.status='PAGA' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='falha de teste'; END IF; END");
      try { await assert.rejects(caixa.pagar(x.id, px.idPreconta)); } finally { await connection.query('DROP TRIGGER falha_quitacao'); }
      assert.equal(await db!.pagamento.count({ where: { idComanda: x.id } }), 0);
      assert.equal((await sprint.sessao(x.s.token)).idComanda, x.id);
      assert.equal(await db!.vinculoCartao.count({ where: { idComanda: x.id } }), 1);
      assert.equal((await db!.comanda.findUniqueOrThrow({ where: { idComanda: x.id } })).status, 'CONTA_SOLICITADA');
      const r = await Promise.all([caixa.pagar(x.id, px.idPreconta), caixa.pagar(y.id, py.idPreconta)]);
      assert.equal(r.filter(p => p.mesaLiberada).length, 1);
      assert.equal((await db!.mesa.findUniqueOrThrow({ where: { idMesa: m.idMesa } })).status, 'LIVRE');
      const antiga = await caixa.documentoEmitido(px.idPreconta); assert.equal(antiga.idComanda, x.id);
      const z = await abrirOutra('20003'); await caixa.solicitar(z.id, z.s.token, 'PIX'); const pz = await caixa.emitir(z.id, []);
      await Promise.all([caixa.pagar(z.id, pz.idPreconta), abrirOutra('20004')]);
      assert.equal((await db!.mesa.findUniqueOrThrow({ where: { idMesa: m.idMesa } })).status, 'OCUPADA');
      assert.equal(await db!.comanda.count({ where: { idMesa: m.idMesa, status: { in: ['ABERTA', 'EM_CONSUMO', 'CONTA_SOLICITADA'] } } }), 1);
    });
  } finally { await db?.$disconnect(); if (created) await connection.query('DROP DATABASE ' + database); await connection.end(); }
});
