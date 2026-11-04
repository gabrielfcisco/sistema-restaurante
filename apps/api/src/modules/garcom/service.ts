import type { ComandaGarcomDto, MesaGarcomDto } from '@restaurante/contracts';
import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { exigir } from '../validacao';
import { statusAgregado, statusPreparo } from '../operacao/service';
const ativos = ['ABERTA', 'EM_CONSUMO', 'CONTA_SOLICITADA'] as const;
export interface GarcomService {
  mesa(value: number, porNumero?: boolean): Promise<MesaGarcomDto>;
  comanda(id: number): Promise<ComandaGarcomDto>;
}
export class PrismaGarcomService implements GarcomService {
  constructor(private db: () => PrismaClient) {}
  async mesa(value: number, porNumero = false): Promise<MesaGarcomDto> {
    const mesa = await this.db().mesa.findUnique({ where: porNumero ? { numero: value } : { idMesa: value },
      select: { idMesa: true, numero: true, comandas: { where: { status: { in: [...ativos] }, dataFechamento: null },
        select: { idComanda: true, status: true, dataAbertura: true }, orderBy: { idComanda: 'asc' } } } });
    exigir(mesa, 404, 'MESA_INEXISTENTE', 'Mesa não encontrada.');
    return { idMesa: mesa.idMesa, numeroMesa: mesa.numero, comandas: mesa.comandas.map(c => ({ ...c, dataAbertura: c.dataAbertura.toISOString() })) };
  }
  async comanda(idComanda: number): Promise<ComandaGarcomDto> {
    const c = await this.db().comanda.findUnique({ where: { idComanda }, include: { mesa: true,
      pedidos: { orderBy: [{ dataHora: 'asc' }, { idPedido: 'asc' }], include: { itens: { include: { produto: true }, orderBy: { idItem: 'asc' } } } } } });
    exigir(c, 404, 'COMANDA_INEXISTENTE', 'Comanda não encontrada.');
    exigir(ativos.some(s => s === c.status) && !c.dataFechamento, 409, 'COMANDA_ENCERRADA', 'Comanda encerrada. Consulte a mesa novamente.');
    let total = new Prisma.Decimal(0);
    const pedidos = c.pedidos.map(p => {
      let valorPedido = new Prisma.Decimal(0);
      const itens = p.itens.map(i => {
        const subtotal = i.produto.preco.mul(i.quantidade);
        valorPedido = valorPedido.add(subtotal);
        return { idItem: i.idItem, idProduto: i.idProduto, nomeProduto: i.produto.nome, quantidade: i.quantidade,
          precoUnitario: i.produto.preco.toNumber(), subtotal: subtotal.toNumber(), observacao: i.observacao,
          setor: i.produto.setor, status: statusPreparo(i.status) };
      });
      total = total.add(valorPedido);
      return { idPedido: p.idPedido, idComanda, idMesa: c.idMesa, numeroMesa: c.mesa.numero,
        dataHora: p.dataHora.toISOString(), status: itens.length ? statusAgregado(itens.map(i => i.status)) : statusPreparo(p.status),
        itens, total: valorPedido.toNumber() };
    });
    return { idComanda, idMesa: c.idMesa, numeroMesa: c.mesa.numero, status: c.status, dataAbertura: c.dataAbertura.toISOString(), pedidos, total: total.toNumber() };
  }
}
