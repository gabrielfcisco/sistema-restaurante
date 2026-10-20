import { Router } from 'express';
import type { SprintService } from '../sprint-service';
import { cpf, nome, objeto, telefone } from '../validacao';

export function clientesRoutes(service: SprintService) {
  const router = Router();
  router.post('/busca', async (req, res) => {
    res.json(await service.buscarCliente(cpf(objeto(req.body).cpf)));
  });
  router.post('/', async (req, res) => {
    const body = objeto(req.body);
    res.status(201).json(await service.criarCliente({ nome: nome(body.nome), cpf: cpf(body.cpf), telefone: telefone(body.telefone) }));
  });
  return router;
}
