import { Router, type Request } from 'express';
import type { SprintService } from '../sprint-service';
import { bearer, igual, type AccessConfig } from '../autorizacao';
import { codigo, exigir, id, objeto } from '../validacao';

export function acessosRoutes(service: SprintService, config: AccessConfig) {
  const router = Router();
  const attempts = new Map<number, { count: number; until: number }>();
  function dispositivo(req: Request) {
    const token = bearer(req);
    const device = config.dispositivos.find(d => igual(d.token, token));
    exigir(device, 401, 'ACESSO_NEGADO', 'Dispositivo não autorizado.');
    return device;
  }
  router.get('/dispositivo', async (req, res) => {
    const device = dispositivo(req);
    res.json(await service.mesaDispositivo(device.token, device.idMesa));
  });
  router.post('/dispositivo', async (req, res) => {
    const device = dispositivo(req);
    const body = objeto(req.body);
    exigir(typeof body.codigoAdmin === 'string' && igual(body.codigoAdmin, 'adm1234'), 403, 'ADMIN_INVALIDO', 'QR administrativo inválido.');
    res.json(await service.configurarDispositivo(device.token, id(body.numero)));
  });
  router.post('/mesa', async (req, res) => {
    exigir(config.dispositivos.length, 503, 'DISPOSITIVO_NAO_CONFIGURADO', 'Dispositivos de mesa não configurados.');
    const token = bearer(req);
    const device = config.dispositivos.find(d => igual(d.token, token));
    exigir(device, 401, 'ACESSO_NEGADO', 'Dispositivo não autorizado.');
    let window = attempts.get(device.idMesa);
    if (!window || window.until <= Date.now()) { window = { count: 0, until: Date.now() + 60000 }; attempts.set(device.idMesa, window); }
    if (++window.count > 10) {
      res.setHeader('Retry-After', Math.ceil((window.until - Date.now()) / 1000));
      exigir(false, 429, 'MUITAS_TENTATIVAS', 'Muitas tentativas. Aguarde um minuto.');
    }
    const body = objeto(req.body);
    const mesa = await service.mesaDispositivo(device.token, device.idMesa);
    // Compatibilidade com consumidores antigos sem confiar no ID enviado.
    if (body.idMesa !== undefined) exigir(id(body.idMesa) === mesa.idMesa, 403, 'MESA_INCORRETA', 'Mesa incompatível com o dispositivo.');
    res.status(201).json(await service.acessar(codigo(body.codigoCartao), mesa.idMesa));
  });
  router.get('/mesa', async (req, res) => { res.json(await service.sessao(bearer(req))); });
  router.delete('/mesa', async (req, res) => { await service.sair(bearer(req)); res.sendStatus(204); });
  return router;
}
