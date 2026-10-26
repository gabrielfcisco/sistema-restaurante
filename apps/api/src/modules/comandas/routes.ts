import { Router } from 'express';
import type { SprintService } from '../sprint-service';
import { autorizarRecepcao, bearer, type AccessConfig } from '../autorizacao';
import type { FilaFeed } from '../operacao/feed';
import { chave, codigo, exigir, id, idRota, objeto, observacaoItem, quantidadeItem } from '../validacao';

export function comandasRoutes(service: SprintService, config: AccessConfig, feed?: FilaFeed) {
  const router = Router();
  const recepcao = autorizarRecepcao(config);
  router.post('/', recepcao, async (req, res) => {
    const body = objeto(req.body);
    exigir(body.confirmarMesaOcupada === undefined || typeof body.confirmarMesaOcupada === 'boolean', 400, 'ENTRADA_INVALIDA', 'Confirmação de mesa ocupada deve ser booleana.');
    const result = await service.abrir({ idCliente: id(body.idCliente), idMesa: id(body.idMesa), codigoCartao: codigo(body.codigoCartao),
      confirmarMesaOcupada: body.confirmarMesaOcupada === true }, chave(req.get('Idempotency-Key')));
    res.status(result.replay ? 200 : 201).json(result.dto);
  });
  router.post('/:idComanda/pedidos', async (req, res) => {
    const token = bearer(req);
    const idComanda = idRota(req.params.idComanda);
    const key = chave(req.get('Idempotency-Key'));
    const body = objeto(req.body);
    exigir(Array.isArray(body.itens), 400, 'ENTRADA_INVALIDA', 'Informe a lista de itens do pedido.');
    exigir(body.itens.length > 0 && body.itens.length <= 100, 400, 'PEDIDO_VAZIO', 'Adicione ao menos um item antes de confirmar o pedido.');
    const itens = body.itens.map(raw => {
      const item = objeto(raw);
      return {
        idProduto: id(item.idProduto),
        quantidade: quantidadeItem(item.quantidade),
        observacao: observacaoItem(item.observacao)
      };
    });
    const result = await service.confirmarPedido(idComanda, { itens }, token, key);
    res.status(result.replay ? 200 : 201).json(result.dto);
    if (!result.replay && feed) {
      const setores = new Set(result.dto.itens.map(i => i.setor));
      for (const setor of setores) void feed.refresh(setor);
    }
  });
  return router;
}
