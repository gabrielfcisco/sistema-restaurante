import 'dotenv/config';
import { getPrisma, disconnectDatabase } from '../src/database/prisma';
// Seed explícito e idempotente. Não altera mesas existentes nem cria clientes reais.
try {
  for (const numero of [1, 2, 3, 4, 5, 6]) {
    await getPrisma().mesa.upsert({ where: { numero }, update: {}, create: { numero } });
  }
  console.log('Seis mesas de desenvolvimento disponíveis.');
} finally { await disconnectDatabase(); }

