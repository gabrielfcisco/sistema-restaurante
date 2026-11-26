import { Router } from 'express';
import type { CriarProdutoInput, ProdutoGestaoDto, SetorOperacional } from '@restaurante/contracts';
import type { PrismaClient } from '../../generated/prisma/client';
import { exigir, idRota, nome, objeto, observacaoItem } from '../validacao';
import { transacao, valorMonetario } from '../caixa/service';
import { validarImagem } from '../../imagens';
export function setorProduto(v: unknown): SetorOperacional {
  exigir(v === 'COZINHA' || v === 'BAR', 400, 'SETOR_INVALIDO', 'Selecione cozinha ou bar.'); return v;
}
function entrada(v: unknown): CriarProdutoInput {
  const b = objeto(v);
  exigir(Object.keys(b).every(k => ['nome', 'descricao', 'preco', 'categoria', 'setor', 'ativo', 'imagemPath'].includes(k)), 400, 'ENTRADA_INVALIDA', 'Campos do produto inválidos.');
  exigir(typeof b.ativo === 'boolean', 400, 'STATUS_INVALIDO', 'Informe a disponibilidade do produto.');
  exigir(typeof b.categoria === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(b.categoria), 400, 'CATEGORIA_INVALIDA', 'Selecione uma categoria existente.');
  return { nome: nome(b.nome), descricao: observacaoItem(b.descricao), preco: valorMonetario(b.preco), categoria: b.categoria, setor: setorProduto(b.setor), ativo: b.ativo, imagemPath: b.imagemPath as string | null | undefined };
}
export class PrismaProdutosService {
  constructor(private db: () => PrismaClient) {}
  private dto(p: { idProduto: number; nome: string; descricao: string | null; preco: { toNumber(): number }; categoria: string; setor: SetorOperacional; ativo: boolean; imagemPath: string | null; grupo: { nome: string; ativo: boolean } }): ProdutoGestaoDto {
    return { idProduto: p.idProduto, nome: p.nome, descricao: p.descricao, preco: p.preco.toNumber(), categoria: p.categoria, setor: p.setor, ativo: p.ativo, imagemPath: p.imagemPath, nomeCategoria: p.grupo.nome, categoriaAtiva: p.grupo.ativo };
  }
  async listar() { return (await this.db().produto.findMany({ where: { excluidoEm: null }, include: { grupo: true }, orderBy: [{ nome: 'asc' }, { idProduto: 'asc' }] })).map(p => this.dto(p)); }
  async criar(value: unknown) {
    const data = entrada(value);
    data.imagemPath = await validarImagem(data.imagemPath);
    return transacao(this.db(), async tx => {
      await tx.$queryRaw`SELECT id_categoria FROM categoria WHERE id_categoria = ${data.categoria} FOR UPDATE`;
      exigir(await tx.categoria.findUnique({ where: { idCategoria: data.categoria } }), 400, 'CATEGORIA_INVALIDA', 'Categoria não encontrada.');
      return this.dto(await tx.produto.create({ data, include: { grupo: true } }));
    });
  }
  async alterar(idProduto: number, value: unknown) {
    const data = entrada(value);
    data.imagemPath = await validarImagem(data.imagemPath);
    return transacao(this.db(), async tx => {
      await tx.$queryRaw`SELECT id_categoria FROM categoria WHERE id_categoria = ${data.categoria} FOR UPDATE`;
      exigir(await tx.categoria.findUnique({ where: { idCategoria: data.categoria } }), 400, 'CATEGORIA_INVALIDA', 'Categoria não encontrada.');
      await tx.$queryRaw`SELECT id_produto FROM produto WHERE id_produto = ${idProduto} FOR UPDATE`;
      const p = await tx.produto.findUnique({ where: { idProduto } });
      exigir(p && !p.excluidoEm, 404, 'PRODUTO_INEXISTENTE', 'Produto não encontrado.');
      if (p.setor !== data.setor) {
        const pendentes = await tx.itemPedido.count({ where: { idProduto, status: { not: 'ENTREGUE' }, pedido: { comanda: { status: { in: ['ABERTA', 'EM_CONSUMO', 'CONTA_SOLICITADA'] }, dataFechamento: null } } } });
        exigir(pendentes === 0, 409, 'SETOR_EM_USO', 'Este produto tem itens não entregues em atendimentos ativos.');
      }
      // Também preserva itens legados inseridos sem snapshot por ferramentas externas.
      await tx.itemPedido.updateMany({ where: { idProduto, precoUnitario: null }, data: { precoUnitario: p.preco } });
      await tx.itemPedido.updateMany({ where: { idProduto, nomeProduto: null }, data: { nomeProduto: p.nome } });
      return this.dto(await tx.produto.update({ where: { idProduto }, data, include: { grupo: true } }));
    });
  }
  async excluir(idProduto: number) {
    return transacao(this.db(), async tx => {
      await tx.$queryRaw`SELECT id_produto FROM produto WHERE id_produto = ${idProduto} FOR UPDATE`;
      const p = await tx.produto.findUnique({ where: { idProduto } });
      exigir(p && !p.excluidoEm, 404, 'PRODUTO_INEXISTENTE', 'Produto não encontrado.');
      await tx.produto.update({ where: { idProduto }, data: { ativo: false, excluidoEm: new Date() } });
    });
  }
  async setor(idProduto: number, setor: SetorOperacional) {
    setorProduto(setor);
    return transacao(this.db(), async tx => {
      // Confirmação de pedido também bloqueia estas linhas, em ordem de ID.
      await tx.$queryRaw`SELECT id_produto FROM produto WHERE id_produto = ${idProduto} FOR UPDATE`;
      const p = await tx.produto.findUnique({ where: { idProduto }, include: { grupo: true } });
      exigir(p && !p.excluidoEm, 404, 'PRODUTO_INEXISTENTE', 'Produto não encontrado.');
      if (p.setor === setor) return this.dto(p);
      const count = await tx.itemPedido.count({ where: { idProduto, status: { not: 'ENTREGUE' }, pedido: { comanda: { status: { in: ['ABERTA', 'EM_CONSUMO', 'CONTA_SOLICITADA'] }, dataFechamento: null } } } });
      exigir(count === 0, 409, 'SETOR_EM_USO', 'Este produto tem itens não entregues em atendimentos ativos.');
      return this.dto(await tx.produto.update({ where: { idProduto }, data: { setor }, include: { grupo: true } }));
    });
  }
}
export function produtosRoutes(service: PrismaProdutosService) {
  const router = Router();
  router.get('/produtos', async (_req, res) => res.json(await service.listar()));
  router.post('/produtos', async (req, res) => res.status(201).json(await service.criar(req.body)));
  router.patch('/produtos/:idProduto', async (req, res) => res.json(await service.alterar(idRota(req.params.idProduto), req.body)));
  router.delete('/produtos/:idProduto', async (req, res) => { await service.excluir(idRota(req.params.idProduto)); res.sendStatus(204); });
  router.patch('/produtos/:idProduto/setor', async (req, res) => {
    const b = objeto(req.body); exigir(Object.keys(b).length === 1 && 'setor' in b, 400, 'ENTRADA_INVALIDA', 'Informe somente o setor.');
    res.json(await service.setor(idRota(req.params.idProduto), setorProduto(b.setor)));
  });
  return router;
}
