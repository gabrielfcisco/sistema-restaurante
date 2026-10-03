import { Router } from 'express';
import type { SprintService } from '../sprint-service';
import { chave, codigo, exigir, id, objeto } from '../validacao';

export function comandasRoutes(service: SprintService) {
  const router = Router();
  router.post('/', async (req, res) => {
    const body = objeto(req.body);
    exigir(body.confirmarMesaOcupada === undefined || typeof body.confirmarMesaOcupada === 'boolean', 400, 'ENTRADA_INVALIDA', 'Confirmação de mesa ocupada deve ser booleana.');
    const result = await service.abrir({ idCliente: id(body.idCliente), idMesa: id(body.idMesa), codigoCartao: codigo(body.codigoCartao),
      confirmarMesaOcupada: body.confirmarMesaOcupada === true }, chave(req.get('Idempotency-Key')));
    res.status(result.replay ? 200 : 201).json(result.dto);
  });
  return router;
}
