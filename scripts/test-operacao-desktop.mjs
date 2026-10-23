// Teste opt-in: somente bancos locais efêmeros criados por este processo.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { readFile, readdir, mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mariadb from 'mariadb';
if (!process.env.TEST_DATABASE_URL) throw new Error('Informe TEST_DATABASE_URL para um servidor local de testes.');
const url = new URL(process.env.TEST_DATABASE_URL);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Somente banco local de testes é permitido.');
const database = 'operacao_desktop_test_' + randomBytes(8).toString('hex');
const root = await mkdtemp(join(tmpdir(), 'restaurante-operacao-desktop-'));
const configPath = join(root, 'config.json');
let created = false, server;
const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), multipleStatements: true });
async function run(command, args, env) {
  const process = spawn(command, args, { env, stdio: 'inherit', windowsHide: true });
  const [code] = await once(process, 'exit');
  if (code !== 0) throw new Error('Teste desktop falhou: ' + code);
}
try {
  await connection.query('CREATE DATABASE ' + database); created = true;
  await connection.query('USE ' + database);
  for (const directory of (await readdir('apps/api/prisma/migrations', { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort())
    await connection.query(await readFile('apps/api/prisma/migrations/' + directory + '/migration.sql', 'utf8'));
  await connection.query("INSERT INTO cliente(nome,cpf,telefone) VALUES ('Cliente ficticio','12345678909','(11) 00000-0000'); INSERT INTO mesa(numero,status) VALUES (8,'OCUPADA'); INSERT INTO comanda(id_cliente,id_mesa) VALUES (1,1)");
  await connection.query("INSERT INTO produto(nome,preco,categoria,setor) VALUES ('File ao molho',30,'PRATO','COZINHA'),('Suco de laranja',8,'BEBIDA','BAR')");
  for (const [id, minutes, status] of [[1, 4, 'RECEBIDO'], [2, 12, 'EM_PREPARO'], [3, 22, 'PRONTO']]) {
    // DATETIME não carrega fuso. Fixtures seguem a mesma convenção UTC dos DTOs/Prisma.
    const arrival = new Date(Date.now() - minutes * 60000).toISOString().slice(0, 19).replace('T', ' ');
    await connection.query('INSERT INTO pedido(id_comanda,data_hora,status) VALUES (1,?,?)', [arrival, status]);
    await connection.query('INSERT INTO item_pedido(id_pedido,id_produto,quantidade,status,observacao) VALUES (?,1,2,?,?), (?,2,2,?,NULL)', [id, status, id === 1 ? 'Sem sal' : null, id, status]);
  }
  const portProbe = createServer().listen(0, '127.0.0.1'); await once(portProbe, 'listening');
  const port = portProbe.address().port; await new Promise(resolve => portProbe.close(resolve));
  url.pathname = '/' + database;
  const base = 'http://127.0.0.1:' + port + '/api';
  await writeFile(configPath, JSON.stringify({ apiUrl: base }));
  const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: url.toString(),
    RESTAURANTE_CONFIG: configPath, OPERACAO_TEST_API: base, OPERACAO_TEST_DATABASE: database };
  server = spawn(process.execPath, ['apps/api/dist/server.js'], { env, stdio: 'inherit', windowsHide: true });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const response = await fetch(base + '/ready', { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break; } }
    catch { /* Aguarda somente o processo iniciado acima. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('API descartável não iniciou.');
  await run(process.execPath, ['node_modules/electron/cli.js', 'scripts/smoke-operacao.mjs'], env);
  const statuses = await connection.query('SELECT status FROM item_pedido WHERE id_item IN (1,2) ORDER BY id_item');
  if (statuses.some(row => row.status !== 'ENTREGUE')) throw new Error('Interface não persistiu a entrega dos itens.');
  console.log('Fluxo dos dois painéis confirmado no banco.');
} finally {
  if (server && server.exitCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
  if (created) await connection.query('DROP DATABASE ' + database);
  await connection.end();
  await unlink(configPath).catch(() => {});
  await rmdir(root);
}
