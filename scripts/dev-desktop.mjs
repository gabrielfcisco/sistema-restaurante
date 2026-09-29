import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';
const server = await createServer({ root: process.cwd() });
await server.listen();
const address = server.resolvedUrls.local[0];
const environment = { ...process.env, ELECTRON_RENDERER_URL: address };
delete environment.ELECTRON_RUN_AS_NODE;
// Este comando abre o aplicativo para uso interativo; não iniciar a janela oculta no Windows.
const desktop = spawn(electron, ['.'], { cwd: process.cwd(), stdio: 'inherit', env: environment, windowsHide: false });
desktop.once('error', async error => { console.error(error); await server.close(); process.exitCode = 1; });
desktop.once('exit', async code => { await server.close(); process.exitCode = code ?? 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { desktop.kill(); void server.close(); });

