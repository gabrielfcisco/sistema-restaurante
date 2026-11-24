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
    void feed.refreshAllComandas();
    for (const setor of ['GARCOM', 'COZINHA', 'BAR'] as const) void feed.refresh(setor);
  });
  router.get('/mesas', async (req, res) => res.json(await service.mesa(idRota(req.query.numero), true)));
  router.get('/mesas/:idMesa/comandas', async (req, res) => res.json(await service.mesa(idRota(req.params.idMesa))));
  router.get('/comandas/:idComanda', async (req, res) => res.json(await service.comanda(idRota(req.params.idComanda))));
  return router;
}
