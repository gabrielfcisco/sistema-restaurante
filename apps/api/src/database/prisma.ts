import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';
let client: PrismaClient | undefined;
export function getPrisma() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Configure DATABASE_URL em apps/api/.env.');
    client = new PrismaClient({ adapter: new PrismaMariaDb(url) });
  }
  return client;
}
export async function disconnectDatabase() { await client?.$disconnect(); }

