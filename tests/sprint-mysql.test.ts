import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import mariadb from 'mariadb';
import { parse } from 'dotenv';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/src/generated/prisma/client';
import { PrismaSprintService, hash } from '../apps/api/src/modules/sprint-service';

// Opt-in: cria e remove SOMENTE um banco efêmero local; nunca aplica migrations ao banco configurado.
test('MySQL: migrations, vínculos, concorrência, rollback, histórico e sessões', { skip: process.env.RUN_MYSQL_TESTS !== '1' }, async () => {
  const env = parse(await readFile('apps/api/.env', 'utf8'));
  const url = new URL(process.env.TEST_DATABASE_URL ?? env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Teste permitido somente em MySQL local.');
  const database = `sprint01_test_${randomBytes(8).toString('hex')}`;
  assert.match(database, /^sprint01_test_[a-f0-9]{16}$/);
  const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), multipleStatements: true });
  let prisma: PrismaClient | undefined;
  let created = false;
  try {
    await connection.query(`CREATE DATABASE \`${database}\``); created = true;
    await connection.query(`USE \`${database}\``);
    for (const migration of ['20260903223000_initial_schema', '20261003000000_sprint01']) {
      await connection.query(await readFile(`apps/api/prisma/migrations/${migration}/migration.sql`, 'utf8'));
    }
    await connection.query("INSERT INTO cliente (nome, cpf) VALUES ('Cliente legado ficticio', '11144477735')");
    await connection.query(await readFile('apps/api/prisma/migrations/20261003010000_cliente_telefone/migration.sql', 'utf8'));
    await connection.query(await readFile('apps/api/prisma/migrations/20261006000000_dispositivo_mesa/migration.sql', 'utf8'));
    url.pathname = `/${database}`;
    prisma = new PrismaClient({ adapter: new PrismaMariaDb(url.toString()) });
    const db = prisma;
    const service = new PrismaSprintService(() => db, 600);
    const cliente = await service.criarCliente({ nome: 'Cliente fictício', cpf: '12345678909', telefone: '(11) 00000-0000' });
    await assert.rejects(service.criarCliente({ nome: 'Duplicado', cpf: cliente.cpf, telefone: '(11) 00000-0000' }), { code: 'CPF_DUPLICADO' });
    assert.equal((await service.buscarCliente('11144477735')).telefone, null);
    assert.equal((await service.buscarCliente(cliente.cpf)).telefone, '(11) 00000-0000');
    await assert.rejects(service.criarCliente({ nome: 'Sem telefone', cpf: '00000000000', telefone: '' }), { code: 'TELEFONE_INVALIDO' });
    for (let numero = 1; numero <= 5; numero++) await db.mesa.create({ data: { numero } });
    const dispositivo = 'dispositivo-ficticio-configuravel';
    assert.deepEqual(await service.mesaDispositivo(dispositivo, 1), { idMesa: 1, numero: 1 });
    const outraMesa = await db.mesa.create({ data: { numero: 42 } });
    assert.deepEqual(await service.configurarDispositivo(dispositivo, 42), { idMesa: outraMesa.idMesa, numero: 42 });
    const reiniciado = new PrismaSprintService(() => db, 600);
    assert.equal((await reiniciado.mesaDispositivo(dispositivo, 1)).numero, 42);
    await assert.rejects(service.configurarDispositivo(dispositivo, 999), { code: 'MESA_INEXISTENTE' });
    assert.equal((await service.mesaDispositivo(dispositivo, 1)).numero, 42);
    await db.mesa.update({ where: { idMesa: 5 }, data: { status: 'MANUTENCAO' } });
    const input = { idCliente: cliente.idCliente, idMesa: 1, codigoCartao: '58324' };
    await service.reservar(1);
    const opened = await service.abrir(input, 'chave-teste-abertura-01');
    assert.equal(opened.dto.status, 'ABERTA');
    assert.equal((await service.abrir(input, 'chave-teste-abertura-01')).replay, true);
    await assert.rejects(service.abrir({ ...input, codigoCartao: '58325' }, 'chave-teste-abertura-01'), { code: 'CHAVE_REUTILIZADA' });
    await assert.rejects(service.abrir({ ...input, codigoCartao: '58325' }, 'chave-teste-abertura-02'), { code: 'CONFIRMACAO_NECESSARIA' });
    await service.abrir({ ...input, codigoCartao: '58325', confirmarMesaOcupada: true }, 'chave-teste-abertura-02');
    assert.equal((await service.detalheMesa(1)).comandasAtivas, 2);
    assert.equal((await service.detalheMesa(1)).atendimentos[0].cpfMascarado, '***.456.789-**');
    await assert.rejects(service.reservar(1), { code: 'MESA_INDISPONIVEL' });
    await assert.rejects(service.acessar('58324', 2), { code: 'MESA_INCORRETA' });
    await assert.rejects(service.acessar('00000', 1), { code: 'CARTAO_INEXISTENTE' });
    const session = await service.acessar('58324', 1);
    assert.equal(session.nomeCliente, cliente.nome);
    assert.equal(session.numeroMesa, 1);
    assert.equal((await service.sessao(session.token)).idComanda, opened.dto.idComanda);
    const stored = await db.sessaoMesa.findUniqueOrThrow({ where: { tokenHash: hash(session.token) } });
    assert.notEqual(stored.tokenHash, session.token);
    await service.sair(session.token);
    await assert.rejects(service.sessao(session.token), { code: 'SESSAO_INVALIDA' });
    await assert.rejects(service.sair(session.token), { code: 'SESSAO_INVALIDA' });
    assert.equal((await service.detalheMesa(1)).comandasAtivas, 2);
    const session2 = await service.acessar('58325', 1);
    const expired = await service.acessar('58324', 1);
    await db.sessaoMesa.update({ where: { tokenHash: hash(expired.token) }, data: { expiraEm: new Date(0) } });
    await assert.rejects(service.sessao(expired.token), { code: 'SESSAO_INVALIDA' });
    await assert.rejects(service.sair(expired.token), { code: 'SESSAO_INVALIDA' });
    assert.equal((await service.liberar(1)).comandasEncerradas, 2);
    await assert.rejects(service.sessao(session2.token), { code: 'SESSAO_INVALIDA' });
    assert.equal(await db.vinculoCartao.count(), 0);
    await assert.rejects(service.sair(session2.token), { code: 'SESSAO_INVALIDA' });
    await assert.rejects(service.acessar('58324', 1), { code: 'SEM_ATENDIMENTO' });
    assert.equal((await db.comanda.findUniqueOrThrow({ where: { idComanda: opened.dto.idComanda } })).status, 'FECHADA');
    assert.equal((await service.abrir(input, 'chave-teste-abertura-01')).replay, true);
    assert.equal((await service.detalheMesa(1)).comandasAtivas, 0);
    const reused = await service.abrir(input, 'chave-teste-abertura-03');
    assert.notEqual(reused.dto.idComanda, opened.dto.idComanda);
    assert.equal(reused.dto.idCartao, opened.dto.idCartao);
    await assert.rejects(service.sessao(session2.token), { code: 'SESSAO_INVALIDA' });
    await assert.rejects(service.abrir({ ...input, idMesa: 5 }, 'chave-teste-abertura-04'), { code: 'MESA_INDISPONIVEL' });
    await service.reservar(4);
    assert.equal((await service.liberar(4)).comandasEncerradas, 0);
    assert.equal((await service.detalheMesa(4)).status, 'LIVRE');

    const concurrent = await Promise.allSettled([2, 3].map(idMesa => service.abrir({ ...input, idMesa, codigoCartao: '99999' }, `chave-concorrente-${idMesa}`)));
    assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(concurrent.filter(r => r.status === 'rejected').length, 1);
    const failed = concurrent.findIndex(r => r.status === 'rejected') + 2;
    assert.equal((await service.detalheMesa(failed)).status, 'LIVRE');
    assert.equal(await db.comanda.count({ where: { cartao: { codigo: '99999' } } }), 1);

    // Falha após criação de cartão/comanda: o trigger força o rollback do vínculo inteiro.
    await connection.query("CREATE TRIGGER falhar_vinculo BEFORE INSERT ON vinculo_cartao FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falha ficticia'");
    await assert.rejects(service.abrir({ ...input, idMesa: 4, codigoCartao: '44444' }, 'chave-rollback-0001'));
    await connection.query('DROP TRIGGER falhar_vinculo');
    assert.equal(await db.cartao.count({ where: { codigo: '44444' } }), 0);
    assert.equal(await db.comanda.count({ where: { chaveAbertura: 'chave-rollback-0001' } }), 0);
    assert.equal((await service.detalheMesa(4)).status, 'LIVRE');

    const repeated = await Promise.all([1, 2].map(() => service.abrir({ ...input, idMesa: 4, codigoCartao: '44444' }, 'chave-idempotente-0001')));
    assert.equal(repeated[0].dto.idComanda, repeated[1].dto.idComanda);
    assert.equal(repeated.filter(r => r.replay).length, 1);
    assert.equal((await service.listarMesas()).find(m => m.idMesa === 4)?.comandasAtivas, 1);
  } finally {
    await prisma?.$disconnect();
    if (created) await connection.query(`DROP DATABASE \`${database}\``);
    await connection.end();
  }
});
