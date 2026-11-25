// Exercita apps reais contra API e banco criados exclusivamente por este runner.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { readFile, readdir, mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mariadb from 'mariadb';
if (!process.env.TEST_DATABASE_URL) throw new Error('Informe TEST_DATABASE_URL local.');
const url = new URL(process.env.TEST_DATABASE_URL);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Somente banco local.');
const database = 'sprint04_desktop_test_' + randomBytes(8).toString('hex');
const root = await mkdtemp(join(tmpdir(), 'restaurante-sprint4-'));
const configPath = join(root, 'config.json');
let created = false, server;
const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), multipleStatements: true });
async function run(command, args, env) { const child = spawn(command, args, { env, stdio: 'inherit', windowsHide: true }); const [code] = await once(child, 'exit'); if (code !== 0) throw new Error('Teste Electron falhou: ' + code); }
try {
  await connection.query('CREATE DATABASE ' + database); created = true; await connection.query('USE ' + database);
  for (const name of (await readdir('apps/api/prisma/migrations', { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort()) await connection.query(await readFile('apps/api/prisma/migrations/' + name + '/migration.sql', 'utf8'));
  await connection.query("INSERT INTO cliente(nome,cpf,telefone) VALUES ('Cliente fictício','12345678909','0000000000'); INSERT INTO mesa(numero,status) VALUES (8,'OCUPADA'); INSERT INTO cartao(codigo) VALUES ('12345'); INSERT INTO comanda(id_cliente,id_mesa,id_cartao) VALUES (1,1,1); INSERT INTO vinculo_cartao(id_cartao,id_comanda) VALUES (1,1)");
  await connection.query("INSERT INTO produto(nome,preco,categoria,setor) VALUES ('Prato teste',49.90,'PRATO','COZINHA'); INSERT INTO pedido(id_comanda,status) VALUES (1,'PRONTO'); INSERT INTO item_pedido(id_pedido,id_produto,quantidade,status) VALUES (1,1,2,'PRONTO')");
  const probe = createServer().listen(0, '127.0.0.1'); await once(probe, 'listening'); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const base = 'http://127.0.0.1:' + port + '/api'; url.pathname = '/' + database;
  const token = 'dispositivo-sprint4-teste-0000000000000000';
  await writeFile(configPath, JSON.stringify({ apiUrl: base, token, mesaId: 1 }));
  const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: url.toString(), MESA_DEVICE_TOKENS: JSON.stringify({ '1': token }), RESTAURANTE_CONFIG: configPath, SPRINT4_TEST_API: base, SPRINT4_TEST_DATABASE: database, SPRINT4_TEST_ARTIFACTS: join(root, 'preconta.pdf') };
  server = spawn(process.execPath, ['apps/api/dist/server.js'], { env, stdio: 'inherit', windowsHide: true });
  let ready = false;
  for (let n = 0; n < 100; n++) { try { if ((await fetch(base + '/ready', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* Aguarda API própria. */ } await new Promise(resolve => setTimeout(resolve, 100)); }
  if (!ready) throw new Error('API descartável não iniciou.');
  await run(process.execPath, ['node_modules/electron/cli.js', 'scripts/smoke-sprint4.mjs', '--disable-gpu'], env);
  const pagamentos = await connection.query('SELECT valor,forma FROM pagamento');
  if (pagamentos.length !== 1 || Number(pagamentos[0].valor) !== 110.89 || pagamentos[0].forma !== 'PIX') throw new Error('Pagamento incorreto no banco.');
  const mesas = await connection.query('SELECT status FROM mesa'); if (mesas[0].status !== 'LIVRE') throw new Error('Mesa não liberada.');
  console.log('Sprint 4: interface persistiu pagamento de R$ 110,89 e liberou a mesa.');
} finally {
  if (server && server.exitCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
  if (created) await connection.query('DROP DATABASE ' + database); await connection.end();
  await unlink(configPath).catch(() => {}); await unlink(join(root, 'preconta.pdf')).catch(() => {}); await rmdir(root);
}
