
import type { HealthResponse, ClienteDto, CriarClienteInput, MesaDto, AbrirAtendimentoInput, AtendimentoDto, SessaoMesaDto, AtendimentoMesaDto, MesaDetalheDto, LiberarMesaDto } from '@restaurante/contracts';
export interface ApiRequest { path: string; method: string; body?: unknown; sessionToken?: string; idempotencyKey?: string }
export interface ApiResult { status: number; data?: unknown }
export type ApiTransport = (request: ApiRequest) => Promise<ApiResult>;
declare global { interface Window { restaurante?: { request: ApiTransport; mesaId?: number } } }
export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 0) { super(message); }
}
export function createApiClient(baseUrl: string, transport?: ApiTransport) {
  const base = baseUrl.replace(/\/$/, '');
  const send = transport ?? (typeof window !== 'undefined' ? window.restaurante?.request : undefined);
  async function request<T>(path: string, method = 'GET', body?: unknown, sessionToken?: string, idempotencyKey?: string): Promise<T> {
    let result: ApiResult;
    try {
      if (send) result = await send({ path, method, body, sessionToken, idempotencyKey });
      else {
        const response = await fetch(base + path, { method,
          headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(sessionToken ? { Authorization: 'Bearer ' + sessionToken } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000) });
        result = { status: response.status, data: response.status === 204 ? undefined : await response.json() };
      }
    } catch { throw new ApiError('SERVIDOR_INDISPONIVEL', 'Servidor indisponível. Verifique a conexão e tente novamente.'); }
    if (result.status < 200 || result.status >= 300) {
      const data = result.data as { error?: { code?: string; message?: string } } | undefined;
      throw new ApiError(data?.error?.code ?? 'RESPOSTA_INVALIDA', data?.error?.message ?? 'Não foi possível concluir a operação.', result.status);
    }
    return result.data as T;
  }
  return {
    mesaDispositivo: () => request<{ idMesa: number; numero: number }>('/acessos/dispositivo'),
    configurarDispositivo: (numero: number, codigoAdmin: string) => request<{ idMesa: number; numero: number }>('/acessos/dispositivo', 'POST', { numero, codigoAdmin }),
    health: () => request<HealthResponse>('/health'),
    buscarCliente: (cpf: string) => request<ClienteDto>('/clientes/busca', 'POST', { cpf }),
    criarCliente: (input: CriarClienteInput) => request<ClienteDto>('/clientes', 'POST', input),
    mesas: () => request<MesaDto[]>('/mesas'),
    detalheMesa: (id: number) => request<MesaDetalheDto>('/mesas/' + id),
    reservar: (id: number) => request<MesaDto>('/mesas/' + id + '/reservar', 'POST'),
    liberar: (id: number) => request<LiberarMesaDto>('/mesas/' + id + '/liberar', 'POST'),
    abrir: (input: AbrirAtendimentoInput, key: string) => request<AtendimentoDto>('/atendimentos', 'POST', input, undefined, key),
    acessar: (codigoCartao: string) => request<SessaoMesaDto>('/acessos/mesa', 'POST', { codigoCartao }),
    sessao: (token: string) => request<AtendimentoMesaDto>('/acessos/mesa', 'GET', undefined, token),
    sair: (token: string) => request<void>('/acessos/mesa', 'DELETE', undefined, token)
  };
}
