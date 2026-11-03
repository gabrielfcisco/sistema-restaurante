import { Router } from 'express';
import type { SprintService } from './sprint-service';
import { autorizarRecepcao, type AccessConfig } from './autorizacao';
import type { FilaFeed } from './operacao/feed';
import { clientesRoutes } from './clientes/routes';
import { mesasRoutes } from './mesas/routes';
import { comandasRoutes } from './comandas/routes';
import { acessosRoutes } from './acessos/routes';
import { cardapioRoutes } from './cardapio/routes';
import { exigir, idRota, objeto } from './validacao';

export function sprintRoutes(service: SprintService, config: AccessConfig, feed?: FilaFeed) {
  const router = Router();
  const recepcao = autorizarRecepcao(config);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use('/clientes', recepcao, clientesRoutes(service));
  router.use('/mesas', recepcao, mesasRoutes(service));
  router.use('/atendimentos', comandasRoutes(service, config, feed));
  router.use('/acessos', acessosRoutes(service, config));
  router.use('/cardapio', cardapioRoutes(service));
  router.get('/garcom/chamados', async (_req, res) => { res.json(await service.listarChamados()); });
  router.patch('/garcom/chamados/:idChamada/status', async (req, res) => {
    const body = objeto(req.body);
    exigir(body.status === 'CONCLUIDA', 400, 'STATUS_INVALIDO', 'Informe status CONCLUIDA.');
    const idChamada = idRota(req.params.idChamada);
    const result = await service.concluirChamada(idChamada);
    res.json(result);
  });
  router.get('/garcom/eventos', (req, res) => {
    res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    res.write('retry: 3000\n: conectado\n\n');
    let previous = '';
    let reading = false;
    const publish = async () => {
      if (reading || res.destroyed || res.writableEnded) return;
      reading = true;
      try {
        const chamados = await service.listarChamados();
        const fingerprint = JSON.stringify(chamados);
        if (fingerprint !== previous) {
          previous = fingerprint;
          res.write('event: chamados\ndata: ' + JSON.stringify({ chamados }) + '\n\n');
        }
      } catch { /* reconexão/Snapshot GET recuperam o estado */ }
      finally { reading = false; }
    };
    void publish();
    const timer = setInterval(() => { void publish(); }, 2000);
    timer.unref();
    const heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(': heartbeat\n\n'); }, 15000);
    heartbeat.unref();
    res.on('close', () => { clearInterval(timer); clearInterval(heartbeat); });
  });
  return router;
}
