import { STATUS_PREPARO, type AlterarStatusItemInput, type ItemFilaDto, type SetorOperacional, type StatusItemDto, type StatusPreparo } from '@restaurante/contracts';
import type { PrismaClient } from '../../generated/prisma/client';
import { exigir } from '../validacao';
import { erroBanco } from '../sprint-service';

const ativos = ['ABERTA', 'EM_CONSUMO', 'CONTA_SOLICITADA'] as const;
export function statusPreparo(status: string): StatusPreparo {
  // PENDENTE é o nome legado de RECEBIDO; o histórico não é reescrito.
  const value = status === 'PENDENTE' ? 'RECEBIDO' : status;
  exigir(STATUS_PREPARO.some(s => s === value), 409, 'STATUS_INCOMPATIVEL', 'O item possui um status incompatível com a fila.');
  return value as StatusPreparo;
}
export function statusAgregado(statuses: string[]): StatusPreparo {
  exigir(statuses.length, 409, 'PEDIDO_SEM_ITENS', 'Pedido sem itens.');
  return STATUS_PREPARO[Math.min(...statuses.map(s => STATUS_PREPARO.indexOf(statusPreparo(s))))];
}
export interface OperacaoService {
  listar(setor: SetorOperacional): Promise<ItemFilaDto[]>;
  avancar(setor: SetorOperacional, idItem: number, input: AlterarStatusItemInput): Promise<StatusItemDto>;
}
export class PrismaOperacaoService implements OperacaoService {
  constructor(private database: () => PrismaClient) {}
  async listar(setor: SetorOperacional): Promise<ItemFilaDto[]> {
    const itens = await this.database().itemPedido.findMany({
      where: { produto: { setor }, status: { in: ['PENDENTE', 'RECEBIDO', 'EM_PREPARO', 'PRONTO'] },
        pedido: { comanda: { status: { in: [...ativos] }, dataFechamento: null } } },
      include: { produto: true, pedido: { include: { comanda: { include: { mesa: true } } } } },
      orderBy: [{ pedido: { dataHora: 'asc' } }, { idPedido: 'asc' }, { idItem: 'asc' }]
    });
    return itens.map(item => ({
      idItem: item.idItem, idPedido: item.idPedido, idComanda: item.pedido.idComanda,
      idMesa: item.pedido.comanda.idMesa, numeroMesa: item.pedido.comanda.mesa.numero,
      nomeProduto: item.produto.nome, quantidade: item.quantidade, observacao: item.observacao,
      setor, status: statusPreparo(item.status) as ItemFilaDto['status'], dataHora: item.pedido.dataHora.toISOString()
    }));
  }
  async avancar(setor: SetorOperacional, idItem: number, input: AlterarStatusItemInput): Promise<StatusItemDto> {
    exigir(STATUS_PREPARO.indexOf(input.status) === STATUS_PREPARO.indexOf(input.statusAtual) + 1,
      409, 'TRANSICAO_INVALIDA', 'Avance somente uma etapa do preparo.');
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.database().$transaction(async tx => {
          const reference = await tx.itemPedido.findUnique({ where: { idItem }, select: { idPedido: true, pedido: { select: { idComanda: true } } } });
          exigir(reference, 404, 'ITEM_INEXISTENTE', 'Item não encontrado neste setor.');
          // Mesma ordem do encerramento: mesa antes do pedido. Serializa os dois setores
          // de um pedido e impede liberar atendimento durante a alteração.
          const comanda = await tx.comanda.findUniqueOrThrow({ where: { idComanda: reference.pedido.idComanda }, select: { idMesa: true } });
          await tx.$queryRaw`SELECT id_mesa FROM mesa WHERE id_mesa = ${comanda.idMesa} FOR UPDATE`;
          await tx.$queryRaw`SELECT id_pedido FROM pedido WHERE id_pedido = ${reference.idPedido} FOR UPDATE`;
          const item = await tx.itemPedido.findUnique({ where: { idItem }, include: { produto: true, pedido: { include: { comanda: true } } } });
          exigir(item && item.produto.setor === setor, 404, 'ITEM_INEXISTENTE', 'Item não encontrado neste setor.');
          exigir(ativos.some(s => s === item.pedido.comanda.status) && !item.pedido.comanda.dataFechamento,
            409, 'ATENDIMENTO_ENCERRADO', 'Atendimento encerrado. Atualize a fila.');
          exigir(statusPreparo(item.status) === input.statusAtual, 409, 'ITEM_ALTERADO', 'Outro operador já alterou este item. A fila será atualizada.');
          const updated = await tx.itemPedido.updateMany({ where: { idItem, status: item.status }, data: { status: input.status } });
          exigir(updated.count === 1, 409, 'ITEM_ALTERADO', 'Outro operador já alterou este item.');
          const statuses = await tx.itemPedido.findMany({ where: { idPedido: item.idPedido }, select: { status: true } });
          const statusPedido = statusAgregado(statuses.map(i => i.status));
          await tx.pedido.update({ where: { idPedido: item.idPedido }, data: { status: statusPedido } });
          return { idItem, status: input.status, statusPedido };
        }, { isolationLevel: 'ReadCommitted', timeout: 10000 });
      } catch (error) {
        if (attempt < 2 && (error as { code?: string }).code === 'P2034') continue;
        throw erroBanco(error);
      }
    }
  }
}
