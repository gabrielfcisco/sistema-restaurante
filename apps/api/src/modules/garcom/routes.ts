import { Router } from 'express';
import type { GarcomService } from './service';
import type { OperacaoService } from '../operacao/service';
import type { FilaFeed } from '../operacao/feed';
import { exigir, idRota, objeto } from '../validacao';
export function garcomRoutes(service: GarcomService, operacao: OperacaoService, feed: FilaFeed) {
  const router = Router();
  router.get('/itens-prontos', async (_req, res) => res.json(await operacao.listar('GARCOM')));
  router.patch('/itens/:idItem/status', async (req, res) => {
    const body = objeto(req.body);
    exigir(body.statusAtual === 'PRONTO' && body.status === 'ENTREGUE', 409, 'TRANSICAO_INVALIDA', 'Somente itens prontos podem ser entregues.');
    res.json(await operacao.avancar('GARCOM', idRota(req.params.idItem), { statusAtual: 'PRONTO', status: 'ENTREGUE' }));
    for (const setor of ['GARCOM', 'COZINHA', 'BAR'] as const) void feed.refresh(setor);
  });
  router.get('/mesas', async (req, res) => res.json(await service.mesa(idRota(req.query.numero), true)));
  router.get('/mesas/:idMesa/comandas', async (req, res) => res.json(await service.mesa(idRota(req.params.idMesa))));
  router.get('/comandas/:idComanda', async (req, res) => res.json(await service.comanda(idRota(req.params.idComanda))));
  router.get('/eventos', (_req, res) => {
    res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders(); res.write('retry: 3000\n: conectado\n\n');
    const stop = feed.subscribe('GARCOM', itens => {
      if (res.destroyed || res.writableEnded) return;
      if (res.writableLength > 65536) { res.end(); return; }
      res.write(itens === null ? 'event: indisponivel\ndata: {}\n\n' : 'event: fila\ndata: ' + JSON.stringify({ itens }) + '\n\n');
    });
    const heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(': heartbeat\n\n'); }, 15000);
    heartbeat.unref();
    res.on('close', () => { clearInterval(heartbeat); stop(); });
  });
  return router;
}
