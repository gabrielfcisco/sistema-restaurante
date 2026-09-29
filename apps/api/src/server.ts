import 'dotenv/config';
import { createApp } from './app';
import { getPrisma, disconnectDatabase } from './database/prisma';
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3333);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
const app = createApp(async () => { await getPrisma().$queryRaw`SELECT 1`; });
const server = app.listen(port, host, () => console.log('API disponível em http://' + host + ':' + port + '/api'));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { server.close(() => { void disconnectDatabase(); }); });
}

