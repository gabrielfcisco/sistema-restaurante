import 'dotenv/config';
import { getPrisma, disconnectDatabase } from '../src/database/prisma';
// Seed explícito e idempotente. Não altera mesas existentes nem cria clientes reais.
const produtosPadrao = [
  { nome: 'Filé ao molho', descricao: 'Filé grelhado ao ponto, servido com molho da casa, purê de batatas e legumes tostados.', preco: 48, categoria: 'PRATO' as const, setor: 'COZINHA' as const },
  { nome: 'Risoto de cogumelos', descricao: 'Arroz arbóreo cremoso com mix de cogumelos frescos e finalizado com parmesão.', preco: 42, categoria: 'PRATO' as const, setor: 'COZINHA' as const },
  { nome: 'Petit gâteau', descricao: 'Bolo quente de chocolate com recheio cremoso e bola de sorvete de creme.', preco: 26, categoria: 'SOBREMESA' as const, setor: 'COZINHA' as const },
  { nome: 'Suco de laranja', descricao: 'Suco natural de laranja espremido na hora (350ml).', preco: 12, categoria: 'BEBIDA' as const, setor: 'BAR' as const },
  { nome: 'Água com gás', descricao: 'Garrafa de água mineral gaseificada gelada (310ml).', preco: 8, categoria: 'BEBIDA' as const, setor: 'BAR' as const }
];
try {
  const db = getPrisma();
  for (const numero of [1, 2, 3, 4, 5, 6, 8]) {
    await db.mesa.upsert({ where: { numero }, update: {}, create: { numero } });
  }
  for (const p of produtosPadrao) {
    const existente = await db.produto.findFirst({ where: { nome: p.nome } });
    if (!existente) await db.produto.create({ data: p });
  }
  console.log('Mesas e produtos de desenvolvimento disponíveis.');
} finally { await disconnectDatabase(); }

