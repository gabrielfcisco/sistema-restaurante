import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import type { HealthResponse } from '@restaurante/contracts';
import { PrismaSprintService, erroBanco, type SprintService } from './modules/sprint-service';
import { sprintRoutes } from './modules/sprint-routes';
import { accessConfig, type AccessConfig } from './modules/autorizacao';
import { ErroApi } from './modules/validacao';
import { getPrisma } from './database/prisma';
import { PrismaOperacaoService, type OperacaoService } from './modules/operacao/service';
import { FilaFeed } from './modules/operacao/feed';
import { operacaoRoutes } from './modules/operacao/routes';

export function createApp(checkDatabase: () => Promise<void>, options: { service?: SprintService; access?: AccessConfig; operacao?: OperacaoService; filaIntervalMs?: number } = {}) {
  const app = express();
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176').split(',').map(s => s.trim());
  app.disable('x-powered-by');
  app.use(cors({ origin(origin, callback) {
    // Apps desktop empacotados (file://) não enviam cookies ou credenciais.
    callback(null, !origin || origin === 'null' || origins.includes(origin));
  } }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'restaurante-api' } satisfies HealthResponse);
  });
  app.get('/api/ready', async (_request, response) => {
    try { await checkDatabase(); response.json({ status: 'ok', database: 'connected' }); }
    catch { response.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Banco de dados indisponível.' } }); }
  });
  const access = options.access ?? accessConfig();
  app.use('/api', sprintRoutes(options.service ?? new PrismaSprintService(getPrisma, access.sessionSeconds), access));
  const operacao = options.operacao ?? new PrismaOperacaoService(getPrisma);
  const feed = new FilaFeed(operacao, options.filaIntervalMs);
  app.use('/api/cozinha', operacaoRoutes('COZINHA', operacao, feed));
  app.use('/api/bar', operacaoRoutes('BAR', operacao, feed));
  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } });
  });
  const handleError: ErrorRequestHandler = (error, _request, response, _next) => {
    void _next;
    const mapped = erroBanco(error);
    if (mapped instanceof ErroApi) {
      response.status(mapped.status).json({ error: { code: mapped.code, message: mapped.message } });
      return;
    }
    const status = error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500;
    response.status(status).json({ error: { code: status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST', message: status === 500 ? 'Erro interno.' : 'Requisição inválida.' } });
  };
  app.use(handleError);
  return app;
}

