export interface HealthResponse { status: 'ok'; service: 'restaurante-api' }
export interface ApiErrorResponse { error: { code: string; message: string } }

// Contratos propostos para a sprint; endpoints de negócio ainda não implementados.
export type StatusMesa = 'LIVRE' | 'OCUPADA' | 'RESERVADA' | 'MANUTENCAO';
export interface ClienteDto { idCliente: number; nome: string; cpf: string }
export interface CriarClienteInput { nome: string; cpf: string }
export interface MesaDto { idMesa: number; numero: number; status: StatusMesa; comandasAtivas: number }
export interface CartaoDisponivelDto { idCartao: number; numero: string }
export interface AbrirAtendimentoInput { idCliente: number; idMesa: number; idCartao: number }
export interface AtendimentoDto { idComanda: number; idCliente: number; idMesa: number; idCartao: number; status: 'ABERTA'; dataAbertura: string }
export interface ValidarAcessoInput { codigoCartao: string; idMesa: number }
export interface SessaoMesaDto { token: string; expiraEm: string; idComanda: number; idMesa: number; nomeCliente: string }

