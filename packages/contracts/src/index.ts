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
