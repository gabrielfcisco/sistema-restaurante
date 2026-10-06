import { createHash, randomBytes } from 'node:crypto';
import type { AbrirAtendimentoInput, AtendimentoDto, ClienteDto, CriarClienteInput, MesaDetalheDto, MesaDto, SessaoMesaDto, LiberarMesaDto, AtendimentoMesaDto } from '@restaurante/contracts';
import type { PrismaClient, Prisma, Comanda, Cartao } from '../generated/prisma/client';
import { ErroApi, exigir, telefone } from './validacao';

const ativos = ['ABERTA', 'EM_CONSUMO', 'CONTA_SOLICITADA'] as const;
const filtroAtivo = { status: { in: [...ativos] } };
export const hash = (text: string) => createHash('sha256').update(text).digest('hex');
function atendimento(c: Comanda & { cartao: Cartao | null }): AtendimentoDto {
  return { idComanda: c.idComanda, idCliente: c.idCliente, idMesa: c.idMesa, idCartao: c.idCartao,
    codigoCartao: c.cartao?.codigo ?? null, status: c.status, dataAbertura: c.dataAbertura.toISOString() };
}
export interface SprintService {
  mesaDispositivo(token: string, idMesaInicial: number): Promise<{ idMesa: number; numero: number }>;
  configurarDispositivo(token: string, numero: number): Promise<{ idMesa: number; numero: number }>;
  buscarCliente(cpf: string): Promise<ClienteDto>;
  criarCliente(input: CriarClienteInput): Promise<ClienteDto>;
  listarMesas(): Promise<MesaDto[]>;
  detalheMesa(idMesa: number): Promise<MesaDetalheDto>;
  abrir(input: AbrirAtendimentoInput, key: string): Promise<{ dto: AtendimentoDto; replay: boolean }>;
  reservar(idMesa: number): Promise<MesaDto>;
  liberar(idMesa: number): Promise<LiberarMesaDto>;
  acessar(codigo: string, idMesa: number): Promise<SessaoMesaDto>;
  sessao(token: string): Promise<AtendimentoMesaDto>;
  sair(token: string): Promise<void>;
}
export function erroBanco(error: unknown): Error {
  if (error instanceof ErroApi) return error;
  const code = (error as { code?: string })?.code;
  if (code === 'P2002') return new ErroApi(409, 'CONFLITO', 'Já existe um registro ou vínculo com estes dados.');
  if (code === 'P2003') return new ErroApi(409, 'VINCULO_INVALIDO', 'O vínculo informado não está disponível.');
  if (code === 'P2025') return new ErroApi(404, 'NAO_ENCONTRADO', 'Registro não encontrado.');
  if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2034', 'P2028'].includes(code ?? ''))
    return new ErroApi(503, 'BANCO_INDISPONIVEL', 'Não foi possível concluir a operação. Tente novamente.');
  return error instanceof Error ? error : new Error('Erro interno.');
}
export class PrismaSprintService implements SprintService {
  constructor(private db: () => PrismaClient, private sessionSeconds = 28800) {}

  async mesaDispositivo(token: string, idMesaInicial: number) {
    const vinculo = await this.db().dispositivoMesa.findUnique({ where: { tokenHash: hash(token) }, include: { mesa: true } });
    const mesa = vinculo?.mesa ?? await this.db().mesa.findUnique({ where: { idMesa: idMesaInicial } });
    exigir(mesa, 404, 'MESA_INEXISTENTE', 'Mesa não encontrada.');
    return { idMesa: mesa.idMesa, numero: mesa.numero };
  }

  async configurarDispositivo(token: string, numero: number) {
    const mesa = await this.db().mesa.findUnique({ where: { numero } });
    exigir(mesa, 404, 'MESA_INEXISTENTE', 'Não existe mesa com este número.');
    await this.db().dispositivoMesa.upsert({ where: { tokenHash: hash(token) },
      create: { tokenHash: hash(token), idMesa: mesa.idMesa }, update: { idMesa: mesa.idMesa } });
    return { idMesa: mesa.idMesa, numero: mesa.numero };
  }

  private async transacao<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db().$transaction(run, { isolationLevel: 'ReadCommitted' }); }
      catch (error) {
        // Reexecuta toda a transação após colisão de criação de cartão/chave ou deadlock.
        if (attempt < 2 && ['P2002', 'P2034'].includes((error as { code?: string }).code ?? '')) continue;
        throw erroBanco(error);
      }
    }
  }
  private async bloquearMesa(tx: Prisma.TransactionClient, idMesa: number) {
    const rows = await tx.$queryRaw<{ id_mesa: number }[]>`SELECT id_mesa FROM mesa WHERE id_mesa = ${idMesa} FOR UPDATE`;
    exigir(rows.length, 404, 'MESA_INEXISTENTE', 'Mesa não encontrada.');
    return tx.mesa.findUniqueOrThrow({ where: { idMesa } });
  }
  async buscarCliente(cpf: string) {
    const cliente = await this.db().cliente.findUnique({ where: { cpf } });
    exigir(cliente, 404, 'CLIENTE_INEXISTENTE', 'Cliente não encontrado.');
    return cliente;
  }
  async criarCliente(input: CriarClienteInput) {
    const data = { ...input, telefone: telefone(input.telefone) };
    try { return await this.db().cliente.create({ data }); }
    catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ErroApi(409, 'CPF_DUPLICADO', 'CPF já cadastrado.');
      throw error;
    }
  }
  async listarMesas(): Promise<MesaDto[]> {
    const mesas = await this.db().mesa.findMany({ orderBy: { numero: 'asc' }, include: { _count: { select: { comandas: { where: filtroAtivo } } } } });
    return mesas.map(({ _count, ...mesa }) => ({ ...mesa, comandasAtivas: _count.comandas }));
  }
  async detalheMesa(idMesa: number): Promise<MesaDetalheDto> {
    const mesa = await this.db().mesa.findUnique({ where: { idMesa }, include: {
      comandas: { where: filtroAtivo, orderBy: { idComanda: 'asc' }, include: { cliente: true, cartao: true } }
    } });
    exigir(mesa, 404, 'MESA_INEXISTENTE', 'Mesa não encontrada.');
    return { idMesa, numero: mesa.numero, status: mesa.status, comandasAtivas: mesa.comandas.length,
      atendimentos: mesa.comandas.map(c => ({ idComanda: c.idComanda, nomeCliente: c.cliente.nome,
        cpfMascarado: `***.${c.cliente.cpf.slice(3, 6)}.${c.cliente.cpf.slice(6, 9)}-**`, codigoCartao: c.cartao?.codigo ?? null })) };
  }
  async abrir(input: AbrirAtendimentoInput, key: string) {
    const fingerprint = hash(JSON.stringify([input.idCliente, input.idMesa, input.codigoCartao, input.confirmarMesaOcupada === true]));
    return this.transacao(async tx => {
      const mesa = await this.bloquearMesa(tx, input.idMesa);
      const anterior = await tx.comanda.findUnique({ where: { chaveAbertura: key }, include: { cartao: true } });
      if (anterior) {
        exigir(anterior.hashAbertura === fingerprint, 409, 'CHAVE_REUTILIZADA', 'Esta chave já foi usada para outra abertura.');
        return { dto: atendimento(anterior), replay: true };
      }
      exigir(mesa.status !== 'MANUTENCAO', 409, 'MESA_INDISPONIVEL', 'Mesa em manutenção.');
      const quantidade = await tx.comanda.count({ where: { idMesa: input.idMesa, ...filtroAtivo } });
      exigir((mesa.status !== 'OCUPADA' && quantidade === 0) || input.confirmarMesaOcupada === true,
        409, 'CONFIRMACAO_NECESSARIA', 'Confirme a inclusão de outra comanda nesta mesa ocupada.');
      exigir(await tx.cliente.findUnique({ where: { idCliente: input.idCliente } }), 404, 'CLIENTE_INEXISTENTE', 'Cliente não encontrado.');
      let cartao = await tx.cartao.findUnique({ where: { codigo: input.codigoCartao } });
      if (!cartao) cartao = await tx.cartao.create({ data: { codigo: input.codigoCartao } });
      await tx.$queryRaw`SELECT id_cartao FROM cartao WHERE id_cartao = ${cartao.idCartao} FOR UPDATE`;
      exigir(!await tx.vinculoCartao.findUnique({ where: { idCartao: cartao.idCartao } }), 409, 'CARTAO_EM_USO', 'Esta comanda física já está em uso.');
      const comanda = await tx.comanda.create({ data: {
        idCliente: input.idCliente, idMesa: input.idMesa, idCartao: cartao.idCartao,
        chaveAbertura: key, hashAbertura: fingerprint, status: 'ABERTA'
      }, include: { cartao: true } });
      await tx.vinculoCartao.create({ data: { idCartao: cartao.idCartao, idComanda: comanda.idComanda } });
      await tx.mesa.update({ where: { idMesa: input.idMesa }, data: { status: 'OCUPADA' } });
      return { dto: atendimento(comanda), replay: false };
    });
  }
  async reservar(idMesa: number): Promise<MesaDto> {
    return this.transacao(async tx => {
      const mesa = await this.bloquearMesa(tx, idMesa);
      const count = await tx.comanda.count({ where: { idMesa, ...filtroAtivo } });
      exigir(mesa.status === 'LIVRE' && count === 0, 409, 'MESA_INDISPONIVEL', 'Somente mesas livres podem ser reservadas.');
      const updated = await tx.mesa.update({ where: { idMesa }, data: { status: 'RESERVADA' } });
      return { ...updated, comandasAtivas: 0 };
    });
  }
  async liberar(idMesa: number): Promise<LiberarMesaDto> {
    return this.transacao(async tx => {
      const mesa = await this.bloquearMesa(tx, idMesa);
      exigir(mesa.status !== 'MANUTENCAO', 409, 'MESA_INDISPONIVEL', 'Mesa em manutenção não pode ser liberada por este fluxo.');
      const now = new Date();
      await tx.sessaoMesa.updateMany({ where: { comanda: { idMesa }, revogadaEm: null }, data: { revogadaEm: now } });
      await tx.vinculoCartao.deleteMany({ where: { comanda: { idMesa } } });
      const closed = await tx.comanda.updateMany({ where: { idMesa, ...filtroAtivo }, data: { status: 'FECHADA', dataFechamento: now } });
      await tx.mesa.update({ where: { idMesa }, data: { status: 'LIVRE' } });
      return { idMesa, status: 'LIVRE', comandasEncerradas: closed.count };
    });
  }
  async acessar(codigo: string, idMesa: number): Promise<SessaoMesaDto> {
    return this.transacao(async tx => {
      const mesa = await this.bloquearMesa(tx, idMesa);
      const cartao = await tx.cartao.findUnique({ where: { codigo }, include: { vinculoAtivo: { include: { comanda: { include: { cliente: true } } } } } });
      exigir(cartao, 404, 'CARTAO_INEXISTENTE', 'Não encontramos esse cartão.');
      const c = cartao.vinculoAtivo?.comanda;
      exigir(c, 409, 'SEM_ATENDIMENTO', 'Este cartão não possui atendimento ativo.');
      exigir(ativos.some(status => status === c.status) && c.dataFechamento === null, 409, 'COMANDA_ENCERRADA', 'Comanda encerrada.');
      exigir(c.idMesa === idMesa, 403, 'MESA_INCORRETA', 'Esta comanda pertence a outra mesa.');
      exigir(mesa.status === 'OCUPADA', 409, 'MESA_INDISPONIVEL', 'Mesa indisponível para acesso.');
      const token = randomBytes(32).toString('base64url');
      const expiraEm = new Date(Date.now() + this.sessionSeconds * 1000);
      await tx.sessaoMesa.create({ data: { tokenHash: hash(token), idComanda: c.idComanda, expiraEm } });
      return { token, expiraEm: expiraEm.toISOString(), idComanda: c.idComanda, codigoCartao: codigo,
        idMesa, numeroMesa: mesa.numero, nomeCliente: c.cliente.nome };
    });
  }
  async sessao(token: string): Promise<AtendimentoMesaDto> {
    const session = await this.db().sessaoMesa.findUnique({ where: { tokenHash: hash(token) },
      include: { comanda: { include: { cliente: true, cartao: true, mesa: true, vinculoAtivo: true } } } });
    exigir(session && !session.revogadaEm && session.expiraEm.getTime() > Date.now(),
      401, 'SESSAO_INVALIDA', 'Sessão ausente, expirada ou revogada.');
    const c = session.comanda;
    exigir(ativos.some(status => status === c.status) && c.dataFechamento === null
      && c.vinculoAtivo && c.vinculoAtivo.idCartao === c.idCartao && c.cartao && c.mesa.status === 'OCUPADA',
      401, 'SESSAO_INVALIDA', 'Atendimento encerrado ou alterado. Identifique seu cartão novamente.');
    return { expiraEm: session.expiraEm.toISOString(), idComanda: c.idComanda, codigoCartao: c.cartao.codigo,
      idMesa: c.idMesa, numeroMesa: c.mesa.numero, nomeCliente: c.cliente.nome };
  }
  async sair(token: string) {
    const now = new Date();
    const result = await this.db().sessaoMesa.updateMany({ where: { tokenHash: hash(token), revogadaEm: null, expiraEm: { gt: now } }, data: { revogadaEm: now } });
    exigir(result.count, 401, 'SESSAO_INVALIDA', 'Sessão ausente, expirada ou revogada.');
  }
}
