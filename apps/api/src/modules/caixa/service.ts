import type { AvisosContasDto, ContaCaixaDto, CobrancaDto, DocumentoContaDto, FechamentoDto, FormaPagamento, PagamentoDto, PagamentoResumoDto, PagamentoDetalheDto, PrecontaDto, TaxaInput } from '@restaurante/contracts';
import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { exigir } from '../validacao';
import { erroBanco, hash, PrismaSprintService } from '../sprint-service';

const ativos = ['ABERTA', 'EM_CONSUMO', 'CONTA_SOLICITADA'] as const;
type Tx = Prisma.TransactionClient;
export async function transacao<T>(db: PrismaClient, run: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(run, { isolationLevel: 'ReadCommitted', timeout: 15000 }); }
    catch (e) { if (attempt < 2 && ['P2034', 'P2002'].includes((e as { code?: string }).code ?? '')) continue; throw erroBanco(e); }
  }
}
async function bloquear(tx: Tx, idComanda: number) {
  const c = await tx.comanda.findUnique({ where: { idComanda }, select: { idMesa: true } });
  exigir(c, 404, 'COMANDA_INEXISTENTE', 'Comanda não encontrada.');
  await tx.$queryRaw`SELECT id_mesa FROM mesa WHERE id_mesa = ${c.idMesa} FOR UPDATE`;
  return tx.comanda.findUniqueOrThrow({ where: { idComanda }, include: { mesa: true, cliente: { select: { nome: true } } } });
}
function aguardando(c: { status: string; dataFechamento: Date | null }) {
  exigir(c.status === 'CONTA_SOLICITADA' && !c.dataFechamento, 409, 'CONTA_INDISPONIVEL', 'Esta comanda não está aguardando pagamento. Atualize a lista.');
}
export function formaPagamento(value: unknown): FormaPagamento {
  exigir(typeof value === 'string' && ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'].includes(value), 400, 'FORMA_INVALIDA', 'Escolha dinheiro, Pix, débito ou crédito.');
  return value as FormaPagamento;
}
export function valorMonetario(value: unknown, max = 99999999.99) {
  exigir(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
    400, 'VALOR_INVALIDO', 'Informe um valor não negativo, dentro do limite e com até duas casas decimais.');
  return value;
}
export function calcularTaxas(subtotal: number, taxas: TaxaInput[]) {
  exigir(Array.isArray(taxas) && taxas.length <= 20, 400, 'TAXAS_INVALIDAS', 'Informe até 20 taxas.');
  const linhas = taxas.map(t => {
    exigir(t && typeof t.nome === 'string' && t.nome.trim().length > 0 && t.nome.trim().length <= 120, 400, 'TAXA_INVALIDA', 'Informe o nome da taxa.');
    exigir(t.tipo === 'PERCENTUAL' || t.tipo === 'FIXA', 400, 'TAXA_INVALIDA', 'Tipo de taxa inválido.');
    valorMonetario(t.valor, t.tipo === 'PERCENTUAL' ? 100 : 99999999.99);
    const total = t.tipo === 'FIXA' ? new Prisma.Decimal(t.valor) : new Prisma.Decimal(subtotal).mul(t.valor).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return { nome: t.nome.trim(), tipo: t.tipo, valor: t.valor, total: total.toNumber() };
  });
  const total = linhas.reduce((sum, t) => sum.add(t.total), new Prisma.Decimal(subtotal));
  exigir(total.lte(99999999.99), 400, 'TOTAL_EXCEDIDO', 'O total excede o limite monetário.');
  return { taxas: linhas, total: total.toNumber() };
}
function precontaDto(p: { idPreconta: number; criadaEm: Date; documento: Prisma.JsonValue }): PrecontaDto {
  return { ...(p.documento as unknown as DocumentoContaDto), idPreconta: p.idPreconta, criadaEm: p.criadaEm.toISOString() };
}
export class PrismaCaixaService {
  constructor(private db: () => PrismaClient) {}
  async fechamento(idComanda: number, token: string): Promise<FechamentoDto> {
    const s = await new PrismaSprintService(this.db).sessao(token);
    exigir(s.idComanda === idComanda, 403, 'COMANDA_INCORRETA', 'A sessão não pertence à comanda informada.');
    const c = await this.db().comanda.findUniqueOrThrow({ where: { idComanda } });
    return { idComanda, status: c.status, formaPagamento: c.formaPagamento, solicitadoEm: c.fechamentoSolicitadoEm?.toISOString() ?? null };
  }
  async solicitar(idComanda: number, token: string, forma: FormaPagamento): Promise<FechamentoDto> {
    formaPagamento(forma);
    return transacao(this.db(), async tx => {
      const c = await bloquear(tx, idComanda);
      const s = await tx.sessaoMesa.findUnique({ where: { tokenHash: hash(token) } });
      exigir(s && !s.revogadaEm && s.expiraEm.getTime() > Date.now(), 401, 'SESSAO_INVALIDA', 'Sessão ausente, expirada ou revogada.');
      exigir(s.idComanda === idComanda, 403, 'COMANDA_INCORRETA', 'A sessão não pertence à comanda informada.');
      const vinculo = await tx.vinculoCartao.findUnique({ where: { idComanda } });
      exigir(ativos.some(v => v === c.status) && !c.dataFechamento && c.mesa.status === 'OCUPADA' && vinculo?.idCartao === c.idCartao,
        401, 'SESSAO_INVALIDA', 'Atendimento encerrado ou alterado.');
      exigir((await this.documento(tx, idComanda)).subtotal > 0, 409, 'CONTA_ZERADA', 'Não é possível solicitar uma conta zerada. Confirme um pedido com valor maior que zero.');
      if (c.status === 'CONTA_SOLICITADA') {
        exigir(c.formaPagamento === forma, 409, 'FECHAMENTO_JA_SOLICITADO', 'O fechamento já foi solicitado com outra forma de pagamento.');
        return { idComanda, status: c.status, formaPagamento: c.formaPagamento, solicitadoEm: c.fechamentoSolicitadoEm?.toISOString() ?? null };
      }
      const now = new Date();
      await tx.comanda.update({ where: { idComanda }, data: { status: 'CONTA_SOLICITADA', formaPagamento: forma, fechamentoSolicitadoEm: now } });
      return { idComanda, status: 'CONTA_SOLICITADA', formaPagamento: forma, solicitadoEm: now.toISOString() };
    });
  }
  async listar() {
    const rows = await this.db().comanda.findMany({ where: { status: 'CONTA_SOLICITADA', dataFechamento: null }, include: { mesa: true, cliente: { select: { nome: true } } }, orderBy: [{ fechamentoSolicitadoEm: 'asc' }, { idComanda: 'asc' }] });
    return rows.map(c => ({ idComanda: c.idComanda, numeroMesa: c.mesa.numero, nomeCliente: c.cliente.nome, formaPagamento: c.formaPagamento, solicitadoEm: c.fechamentoSolicitadoEm?.toISOString() ?? null }));
  }
  async pagamentos(antes?: number): Promise<PagamentoResumoDto[]> {
    const rows = await this.db().pagamento.findMany({ where: antes ? { idPagamento: { lt: antes } } : {}, orderBy: { idPagamento: 'desc' }, take: 30, include: { preconta: true } });
    return rows.map(p => {
      const d = precontaDto(p.preconta);
      return { idPagamento: p.idPagamento, idComanda: p.idComanda, idPreconta: p.idPreconta, forma: p.forma, valor: p.valor.toNumber(), pagoEm: p.pagoEm.toISOString(), numeroMesa: d.numeroMesa, nomeCliente: d.nomeCliente };
    });
  }
  async pagamento(idPagamento: number): Promise<PagamentoDetalheDto> {
    const p = await this.db().pagamento.findUnique({ where: { idPagamento }, include: { preconta: true } });
    exigir(p, 404, 'PAGAMENTO_INEXISTENTE', 'Pagamento não encontrado.');
    const preconta = precontaDto(p.preconta);
    return { idPagamento, idComanda: p.idComanda, idPreconta: p.idPreconta, forma: p.forma, valor: p.valor.toNumber(), pagoEm: p.pagoEm.toISOString(), numeroMesa: preconta.numeroMesa, nomeCliente: preconta.nomeCliente, preconta };
  }
  private async documento(tx: Tx, idComanda: number): Promise<DocumentoContaDto> {
    const c = await tx.comanda.findUniqueOrThrow({ where: { idComanda }, include: { mesa: true, cliente: { select: { nome: true } }, pedidos: { orderBy: { idPedido: 'asc' }, include: { itens: { orderBy: { idItem: 'asc' }, include: { produto: true } } } } } });
    const itens = c.pedidos.flatMap(p => p.itens.map(i => ({ idItem: i.idItem, idPedido: p.idPedido, nomeProduto: i.nomeProduto ?? i.produto.nome, quantidade: i.quantidade, precoUnitario: (i.precoUnitario ?? i.produto.preco).toNumber(), subtotal: (i.precoUnitario ?? i.produto.preco).mul(i.quantidade).toNumber(), status: i.status === 'PENDENTE' ? 'RECEBIDO' as const : i.status })));
    const subtotal = itens.reduce((sum, i) => sum.add(i.subtotal), new Prisma.Decimal(0)).toNumber();
    exigir(subtotal <= 99999999.99, 409, 'TOTAL_EXCEDIDO', 'Consumo excede o limite da conta.');
    return { idComanda, numeroMesa: c.mesa.numero, nomeCliente: c.cliente.nome, formaPagamento: c.formaPagamento, solicitadoEm: c.fechamentoSolicitadoEm?.toISOString() ?? null, itens, subtotal, taxas: [], total: subtotal };
  }
  async detalhe(idComanda: number): Promise<ContaCaixaDto> {
    return transacao(this.db(), async tx => {
      aguardando(await bloquear(tx, idComanda));
      const d = await this.documento(tx, idComanda);
      const p = await tx.preConta.findFirst({ where: { idComanda }, orderBy: { idPreconta: 'desc' } });
      return { ...d, todosEntregues: d.itens.every(i => i.status === 'ENTREGUE'), preconta: p ? precontaDto(p) : null };
    });
  }
  async documentoEmitido(idPreconta: number): Promise<PrecontaDto> {
    const p = await this.db().preConta.findUnique({ where: { idPreconta } });
    exigir(p, 404, 'PRECONTA_INEXISTENTE', 'Pré-conta não encontrada.');
    return precontaDto(p);
  }
  async emitir(idComanda: number, taxas: TaxaInput[]): Promise<PrecontaDto> {
    return transacao(this.db(), async tx => {
      const c = await bloquear(tx, idComanda); aguardando(c);
      exigir(c.formaPagamento, 409, 'FORMA_AUSENTE', 'A comanda não informa forma de pagamento.');
      const base = await this.documento(tx, idComanda);
      exigir(base.subtotal > 0, 409, 'CONTA_ZERADA', 'Não é possível emitir uma conta zerada.');
      const documento = { ...base, ...calcularTaxas(base.subtotal, taxas) };
      // Não substitui uma conta já enviada ao garçom antes de seu retorno.
      exigir(!await tx.cobranca.findFirst({ where: { concluidaEm: null, preconta: { idComanda } } }), 409, 'COBRANCA_PENDENTE', 'Aguarde o retorno do garçom antes de emitir outra versão.');
      const p = await tx.preConta.create({ data: { idComanda, documento: documento as unknown as Prisma.InputJsonValue } });
      return precontaDto(p);
    });
  }
  private async vigente(tx: Tx, idComanda: number, idPreconta: number) {
    const p = await tx.preConta.findFirst({ where: { idComanda }, orderBy: { idPreconta: 'desc' } });
    exigir(p?.idPreconta === idPreconta, 409, 'PRECONTA_DESATUALIZADA', 'A pré-conta foi alterada. Atualize e confira novamente.');
    const documento = precontaDto(p), atual = await this.documento(tx, idComanda);
    const assinatura = (d: DocumentoContaDto) => JSON.stringify([d.formaPagamento, d.subtotal, d.itens.map(i => [i.idItem, i.nomeProduto, i.quantidade, i.precoUnitario, i.subtotal])]);
    exigir(assinatura(documento) === assinatura(atual), 409, 'PRECONTA_DESATUALIZADA', 'O consumo foi alterado. Emita uma nova pré-conta.');
    return documento;
  }
  async chamar(idComanda: number, idPreconta: number): Promise<CobrancaDto> {
    return transacao(this.db(), async tx => {
      const c = await bloquear(tx, idComanda); aguardando(c);
      await this.vigente(tx, idComanda, idPreconta);
      const r = await tx.cobranca.upsert({ where: { idPreconta }, create: { idPreconta }, update: {} });
      return { ...r, idComanda, numeroMesa: c.mesa.numero, criadaEm: r.criadaEm.toISOString(), concluidaEm: r.concluidaEm?.toISOString() ?? null };
    });
  }
  async avisos(): Promise<AvisosContasDto> {
    const solicitacoes = (await this.listar()).map(({ nomeCliente, ...c }) => { void nomeCliente; return c; });
    const rows = await this.db().cobranca.findMany({ where: { concluidaEm: null, preconta: { comanda: { status: 'CONTA_SOLICITADA', dataFechamento: null } } }, include: { preconta: { include: { comanda: { include: { mesa: true } } } } }, orderBy: { idCobranca: 'asc' } });
    return { solicitacoes, cobrancas: rows.map(r => ({ idCobranca: r.idCobranca, idPreconta: r.idPreconta, idComanda: r.preconta.idComanda, numeroMesa: r.preconta.comanda.mesa.numero, criadaEm: r.criadaEm.toISOString(), concluidaEm: null })) };
  }
  async concluir(idCobranca: number) {
    return transacao(this.db(), async tx => {
      const r = await tx.cobranca.findUnique({ where: { idCobranca }, include: { preconta: true } });
      exigir(r, 404, 'COBRANCA_INEXISTENTE', 'Cobrança não encontrada.');
      aguardando(await bloquear(tx, r.preconta.idComanda));
      await tx.cobranca.updateMany({ where: { idCobranca, concluidaEm: null }, data: { concluidaEm: new Date() } });
      return { idCobranca };
    });
  }
  async pagar(idComanda: number, idPreconta: number): Promise<PagamentoDto> {
    return transacao(this.db(), async tx => {
      const c = await bloquear(tx, idComanda);
      exigir(!await tx.pagamento.findUnique({ where: { idComanda } }), 409, 'PAGAMENTO_DUPLICADO', 'Esta comanda já foi paga.');
      aguardando(c);
      const d = await this.vigente(tx, idComanda, idPreconta);
      exigir(d.subtotal > 0, 409, 'CONTA_ZERADA', 'Não é possível pagar uma conta zerada.');
      exigir(d.formaPagamento, 409, 'FORMA_AUSENTE', 'Forma de pagamento não informada.');
      exigir(await tx.itemPedido.count({ where: { pedido: { idComanda }, status: { not: 'ENTREGUE' } } }) === 0, 409, 'ITENS_PENDENTES', 'Entregue todos os itens antes de confirmar o pagamento.');
      const now = new Date();
      const p = await tx.pagamento.create({ data: { idComanda, idPreconta, forma: d.formaPagamento, valor: d.total, pagoEm: now } });
      await tx.comanda.update({ where: { idComanda }, data: { status: 'PAGA', dataFechamento: now } });
      await tx.sessaoMesa.updateMany({ where: { idComanda, revogadaEm: null }, data: { revogadaEm: now } });
      await tx.vinculoCartao.deleteMany({ where: { idComanda } });
      await tx.cobranca.updateMany({ where: { preconta: { idComanda }, concluidaEm: null }, data: { concluidaEm: now } });
      const restam = await tx.comanda.count({ where: { idMesa: c.idMesa, status: { in: [...ativos] }, dataFechamento: null } });
      if (!restam) {
        await tx.mesa.update({ where: { idMesa: c.idMesa }, data: { status: 'LIVRE' } });
        await tx.chamada.updateMany({ where: { idMesa: c.idMesa, status: 'PENDENTE' }, data: { status: 'CANCELADA', finalizadaEm: now } });
      }
      return { idPagamento: p.idPagamento, idComanda, idPreconta, forma: p.forma, valor: p.valor.toNumber(), pagoEm: p.pagoEm.toISOString(), mesaLiberada: restam === 0 };
    });
  }
}

