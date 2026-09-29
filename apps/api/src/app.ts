import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import type { HealthResponse } from '@restaurante/contracts';

export function createApp(checkDatabase: () => Promise<void>) {
  const app = express();
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174').split(',').map(s => s.trim());
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
  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } });
  });
  const handleError: ErrorRequestHandler = (error, _request, response, _next) => {
    void _next;
    const status = error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500;
    response.status(status).json({ error: { code: status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST', message: status === 500 ? 'Erro interno.' : 'Requisição inválida.' } });
  };
  app.use(handleError);
  return app;
}

