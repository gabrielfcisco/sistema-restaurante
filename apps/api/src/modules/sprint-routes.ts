import { Router } from 'express';
import type { SprintService } from './sprint-service';
import { autorizarRecepcao, type AccessConfig } from './autorizacao';
import { clientesRoutes } from './clientes/routes';
import { mesasRoutes } from './mesas/routes';
import { comandasRoutes } from './comandas/routes';
import { acessosRoutes } from './acessos/routes';

export function sprintRoutes(service: SprintService, config: AccessConfig) {
  const router = Router();
  const recepcao = autorizarRecepcao(config);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use('/clientes', recepcao, clientesRoutes(service));
  router.use('/mesas', recepcao, mesasRoutes(service));
  router.use('/atendimentos', recepcao, comandasRoutes(service));
  router.use('/acessos', acessosRoutes(service, config));
  return router;
}
