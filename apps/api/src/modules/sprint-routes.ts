import { Router } from 'express';
import type { SprintService } from './sprint-service';
import { autorizarRecepcao, type AccessConfig } from './autorizacao';
import type { FilaFeed } from './operacao/feed';
import { clientesRoutes } from './clientes/routes';
import { mesasRoutes } from './mesas/routes';
import { comandasRoutes } from './comandas/routes';
import { acessosRoutes } from './acessos/routes';
import { cardapioRoutes } from './cardapio/routes';

export function sprintRoutes(service: SprintService, config: AccessConfig, feed?: FilaFeed) {
  const router = Router();
  const recepcao = autorizarRecepcao(config);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use('/clientes', recepcao, clientesRoutes(service));
  router.use('/mesas', recepcao, mesasRoutes(service));
  router.use('/atendimentos', comandasRoutes(service, config, feed));
  router.use('/acessos', acessosRoutes(service, config));
  router.use('/cardapio', cardapioRoutes(service));
  return router;
}
