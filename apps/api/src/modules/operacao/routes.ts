import { Router } from 'express';
import { STATUS_PREPARO, type AlterarStatusItemInput, type SetorOperacional } from '@restaurante/contracts';
import type { OperacaoService } from './service';
import { FilaFeed } from './feed';
import { exigir, idRota, objeto } from '../validacao';
export function operacaoRoutes(setor: SetorOperacional, service: OperacaoService, feed: FilaFeed) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/itens', async (_req, res) => { res.json(await service.listar(setor)); });
  router.patch('/itens/:idItem/status', async (req, res) => {
    const body = objeto(req.body);
    exigir(STATUS_PREPARO.slice(0, -1).some(s => s === body.statusAtual) && STATUS_PREPARO.some(s => s === body.status),
      400, 'STATUS_INVALIDO', 'Informe o status atual e o próximo status do item.');
    const result = await service.avancar(setor, idRota(req.params.idItem), body as unknown as AlterarStatusItemInput);
    res.json(result);
    void feed.refresh(setor);
  });
  router.get('/eventos', (_req, res) => {
    res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    res.write('retry: 3000\n: conectado\n\n');
    const unsubscribe = feed.subscribe(setor, itens => {
      if (res.destroyed || res.writableEnded) return;
      if (res.writableLength > 65536) { res.end(); return; }
      res.write(itens === null ? 'event: indisponivel\ndata: {}\n\n' : 'event: fila\ndata: ' + JSON.stringify({ itens }) + '\n\n');
    });
    const heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(': heartbeat\n\n'); }, 15000);
    heartbeat.unref();
    res.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
  });
  return router;
}
