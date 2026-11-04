import { Router } from 'express';
import type { CategoriasService } from './service';
import { exigir, nome, objeto } from '../validacao';
export function administracaoRoutes(service: CategoriasService) {
  const router = Router();
  router.get('/categorias', async (_req, res) => res.json(await service.listar()));
  router.post('/categorias', async (req, res) => {
    const body = objeto(req.body);
    exigir(Object.keys(body).every(k => k === 'nome'), 400, 'ENTRADA_INVALIDA', 'Informe somente o nome da categoria.');
    res.status(201).json(await service.criar(nome(body.nome)));
  });
  router.patch('/categorias/:idCategoria', async (req, res) => {
    const body = objeto(req.body);
    exigir(/^[A-Za-z0-9_-]{1,32}$/.test(req.params.idCategoria), 400, 'ID_INVALIDO', 'Categoria inválida.');
    exigir(Object.keys(body).length && Object.keys(body).every(k => k === 'nome' || k === 'ativo'), 400, 'ENTRADA_INVALIDA', 'Informe nome e/ou status.');
    exigir(body.ativo === undefined || typeof body.ativo === 'boolean', 400, 'STATUS_INVALIDO', 'Informe ativo como booleano.');
    res.json(await service.alterar(req.params.idCategoria, {
      ...(body.nome !== undefined ? { nome: nome(body.nome) } : {}),
      ...(body.ativo !== undefined ? { ativo: body.ativo as boolean } : {})
    }));
  });
  return router;
}
