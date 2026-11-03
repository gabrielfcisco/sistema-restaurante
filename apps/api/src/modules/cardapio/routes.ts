import { Router } from 'express';
import type { CategoriaCardapio } from '@restaurante/contracts';
import type { SprintService } from '../sprint-service';
import { bearer } from '../autorizacao';
import { exigir, idRota } from '../validacao';

const categoriasValidas: CategoriaCardapio[] = ['PRATO', 'SOBREMESA', 'BEBIDA'];

export function cardapioRoutes(service: SprintService) {
  const router = Router();
  router.get('/categorias', async (req, res) => {
    res.json(await service.categoriasCardapio(bearer(req)));
  });
  router.get('/produtos', async (req, res) => {
    const token = bearer(req);
    const raw = req.query.categoria;
    if (raw !== undefined) {
      exigir(typeof raw === 'string' && categoriasValidas.includes(raw as CategoriaCardapio),
        400, 'CATEGORIA_INVALIDA', 'Categoria de cardápio inválida.');
      res.json(await service.produtosCardapio(token, raw as CategoriaCardapio));
      return;
    }
    res.json(await service.produtosCardapio(token));
  });
  router.get('/produtos/:idProduto', async (req, res) => {
    res.json(await service.detalheProduto(bearer(req), idRota(req.params.idProduto)));
  });
  return router;
}
