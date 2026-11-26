import { Router, type Response } from 'express';
import type { TaxaInput } from '@restaurante/contracts';
import { bearer } from '../autorizacao';
import { exigir, id, idRota, objeto } from '../validacao';
import { formaPagamento, type PrismaCaixaService } from './service';

function stream(res: Response, read: () => Promise<unknown>) {
  res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders(); res.write('retry: 3000\n: conectado\n\n');
  let previous = '', busy = false;
  const send = async () => {
    if (busy || res.destroyed || res.writableEnded) return;
    busy = true;
    try {
      const value = JSON.stringify(await read());
      if (res.destroyed || res.writableEnded) return;
      if (res.writableLength > 65536) { res.end(); return; }
      if (previous !== value) { res.write('event: contas\ndata: ' + value + '\n\n'); previous = value; }
    } catch { previous = ''; if (!res.destroyed && !res.writableEnded) res.write('event: indisponivel\ndata: {}\n\n'); }
    finally { busy = false; }
  };
  void send();
  const timer = setInterval(() => void send(), 2000), heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(': heartbeat\n\n'); }, 15000);
  timer.unref(); heartbeat.unref();
  res.on('close', () => { clearInterval(timer); clearInterval(heartbeat); });
}
export function caixaRoutes(service: PrismaCaixaService) {
  const router = Router();
  router.get('/caixa/pagamentos', async (req, res) => res.json(await service.pagamentos(req.query.antes === undefined ? undefined : idRota(req.query.antes))));
  router.get('/caixa/pagamentos/:idPagamento', async (req, res) => res.json(await service.pagamento(idRota(req.params.idPagamento))));
  router.get('/caixa/comandas', async (_req, res) => res.json(await service.listar()));
  router.get('/caixa/precontas/:idPreconta', async (req, res) => res.json(await service.documentoEmitido(idRota(req.params.idPreconta))));
  router.get('/caixa/eventos', (_req, res) => stream(res, () => service.listar()));
  router.get('/caixa/comandas/:idComanda', async (req, res) => res.json(await service.detalhe(idRota(req.params.idComanda))));
  router.post('/caixa/comandas/:idComanda/preconta', async (req, res) => {
    const b = objeto(req.body);
    exigir(Object.keys(b).length === 1 && Array.isArray(b.taxas) && b.taxas.length <= 20, 400, 'ENTRADA_INVALIDA', 'Informe somente a lista de até 20 taxas.');
    const taxas = b.taxas.map(v => { const t = objeto(v); exigir(Object.keys(t).every(k => ['nome', 'tipo', 'valor'].includes(k)), 400, 'TAXA_INVALIDA', 'Campos da taxa inválidos.'); return t as unknown as TaxaInput; });
    res.status(201).json(await service.emitir(idRota(req.params.idComanda), taxas));
  });
  for (const action of ['chamar-garcom', 'pagamento'] as const) {
    router.post('/caixa/comandas/:idComanda/' + action, async (req, res) => {
      const b = objeto(req.body);
      exigir(Object.keys(b).length === 1 && 'idPreconta' in b, 400, 'ENTRADA_INVALIDA', 'Informe somente a versão da pré-conta conferida.');
      const idComanda = idRota(req.params.idComanda), idPreconta = id(b.idPreconta);
      res.json(await (action === 'pagamento' ? service.pagar(idComanda, idPreconta) : service.chamar(idComanda, idPreconta)));
    });
  }
  router.get('/garcom/contas', async (_req, res) => res.json(await service.avisos()));
  router.get('/garcom/contas/eventos', (_req, res) => stream(res, () => service.avisos()));
  router.patch('/garcom/cobrancas/:idCobranca/status', async (req, res) => {
    const b = objeto(req.body); exigir(b.status === 'CONCLUIDA' && Object.keys(b).length === 1, 400, 'ENTRADA_INVALIDA', 'Informe status CONCLUIDA.');
    res.json(await service.concluir(idRota(req.params.idCobranca)));
  });
  router.get('/atendimentos/:idComanda/fechamento', async (req, res) => res.json(await service.fechamento(idRota(req.params.idComanda), bearer(req))));
  router.post('/atendimentos/:idComanda/solicitar-fechamento', async (req, res) => {
    const token = bearer(req), b = objeto(req.body);
    exigir(Object.keys(b).length === 1 && 'formaPagamento' in b, 400, 'ENTRADA_INVALIDA', 'Informe somente a forma de pagamento.');
    res.json(await service.solicitar(idRota(req.params.idComanda), token, formaPagamento(b.formaPagamento)));
  });
  return router;
}
