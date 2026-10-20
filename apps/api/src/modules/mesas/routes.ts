import { Router } from 'express';
import type { SprintService } from '../sprint-service';
import { idRota } from '../validacao';

export function mesasRoutes(service: SprintService) {
  const router = Router();
  router.get('/', async (_req, res) => { res.json(await service.listarMesas()); });
  router.get('/:idMesa', async (req, res) => { res.json(await service.detalheMesa(idRota(req.params.idMesa))); });
  router.post('/:idMesa/reservar', async (req, res) => { res.json(await service.reservar(idRota(req.params.idMesa))); });
  router.post('/:idMesa/liberar', async (req, res) => { res.json(await service.liberar(idRota(req.params.idMesa))); });
  return router;
}
