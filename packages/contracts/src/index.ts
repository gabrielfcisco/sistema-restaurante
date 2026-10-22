export interface HealthResponse { status: 'ok'; service: 'restaurante-api' }
export interface ApiErrorResponse { error: { code: string; message: string } }
export type StatusMesa = 'LIVRE' | 'OCUPADA' | 'RESERVADA' | 'MANUTENCAO';
export type StatusComanda = 'ABERTA' | 'EM_CONSUMO' | 'CONTA_SOLICITADA' | 'PAGA' | 'FECHADA';
// null somente para cadastros anteriores à inclusão do telefone.
export interface ClienteDto { idCliente: number; nome: string; cpf: string; telefone: string | null }
export interface CriarClienteInput { nome: string; cpf: string; telefone: string }
export interface MesaDto { idMesa: number; numero: number; status: StatusMesa; comandasAtivas: number }
export interface AtendimentoResumoDto { idComanda: number; nomeCliente: string; cpfMascarado: string; codigoCartao: string | null }
export interface MesaDetalheDto extends MesaDto { atendimentos: AtendimentoResumoDto[] }
export interface AbrirAtendimentoInput { idCliente: number; idMesa: number; codigoCartao: string; confirmarMesaOcupada?: boolean }
export interface AtendimentoDto {
  idComanda: number; idCliente: number; idMesa: number; idCartao: number | null;
  codigoCartao: string | null; status: StatusComanda; dataAbertura: string;
}
// A mesa é determinada pela credencial do dispositivo, não pelo corpo da requisição.
export interface ValidarAcessoInput { codigoCartao: string }
export interface SessaoMesaDto {
  token: string; expiraEm: string; idComanda: number; codigoCartao: string;
  idMesa: number; numeroMesa: number; nomeCliente: string;
}
export interface LiberarMesaDto { idMesa: number; status: 'LIVRE'; comandasEncerradas: number }
export type AtendimentoMesaDto = Omit<SessaoMesaDto, 'token'>;
export function normalizarCpf(value: string) { return value.replace(/\D/g, ''); }
export function cpfValido(value: string) {
  if (!/^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(value)) return false;
  const cpf = normalizarCpf(value);
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  for (const length of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    if ((sum * 10) % 11 % 10 !== Number(cpf[length])) return false;
  }
  return true;
}
export function mascararCpf(cpf: string) { return '***.***.' + cpf.slice(6, 9) + '-' + cpf.slice(9); }

export type SetorOperacional = 'COZINHA' | 'BAR';
export const STATUS_PREPARO = ['RECEBIDO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE'] as const;
export type StatusPreparo = typeof STATUS_PREPARO[number];
export type StatusFila = Exclude<StatusPreparo, 'ENTREGUE'>;
export interface ItemFilaDto {
  idItem: number; idPedido: number; idComanda: number; idMesa: number; numeroMesa: number;
  nomeProduto: string; quantidade: number; observacao: string | null; setor: SetorOperacional;
  status: StatusFila; dataHora: string;
}
export interface AlterarStatusItemInput { statusAtual: StatusFila; status: StatusPreparo }
export interface StatusItemDto { idItem: number; status: StatusPreparo; statusPedido: StatusPreparo }
export interface FilaEventoDto { itens: ItemFilaDto[] }
