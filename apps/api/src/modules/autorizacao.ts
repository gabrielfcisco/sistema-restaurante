import type { Request, RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { exigir, id, objeto } from './validacao';

export interface AccessConfig { recepcaoToken?: string; dispositivos: { token: string; idMesa: number }[]; sessionSeconds: number }
export function accessConfig(): AccessConfig {
  const recepcaoToken = process.env.RECEPCAO_API_TOKEN;
  if (recepcaoToken && !/^[A-Za-z0-9._~-]{32,}$/.test(recepcaoToken)) throw new Error('RECEPCAO_API_TOKEN deve ter ao menos 32 caracteres válidos para Bearer.');
  const raw: unknown = JSON.parse(process.env.MESA_DEVICE_TOKENS ?? '{}');
  const entries = Object.entries(objeto(raw));
  const tokens = new Set<string>();
  const dispositivos = entries.map(([mesa, token]) => {
    if (!/^[1-9]\d*$/.test(mesa) || typeof token !== 'string' || !/^[A-Za-z0-9._~-]{32,}$/.test(token) || tokens.has(token) || token === recepcaoToken)
      throw new Error('MESA_DEVICE_TOKENS deve mapear IDs de mesa para tokens exclusivos de pelo menos 32 caracteres.');
    tokens.add(token);
    return { idMesa: id(Number(mesa)), token };
  });
  const sessionSeconds = Number(process.env.MESA_SESSION_SECONDS ?? 28800);
  if (!Number.isInteger(sessionSeconds) || sessionSeconds < 60 || sessionSeconds > 86400) throw new Error('MESA_SESSION_SECONDS deve estar entre 60 e 86400.');
  return { recepcaoToken, dispositivos, sessionSeconds };
}
export function igual(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function bearer(req: Request): string {
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(req.get('Authorization') ?? '');
  exigir(match, 401, 'ACESSO_NEGADO', 'Credencial de acesso ausente ou inválida.');
  return match[1];
}

export function autorizarRecepcao(config: AccessConfig): RequestHandler {
  return (req, _res, next) => {
    exigir(config.recepcaoToken, 503, 'AUTORIZACAO_NAO_CONFIGURADA', 'Acesso da recepção não configurado.');
    exigir(igual(bearer(req), config.recepcaoToken), 401, 'ACESSO_NEGADO', 'Credencial de acesso inválida.');
    next();
  };
}
