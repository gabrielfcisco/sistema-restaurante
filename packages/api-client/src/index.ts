
import type { HealthResponse, ClienteDto, CriarClienteInput, MesaDto, AbrirAtendimentoInput, AtendimentoDto, SessaoMesaDto, AtendimentoMesaDto, MesaDetalheDto, LiberarMesaDto, ItemFilaDto, SetorOperacional, AlterarStatusItemInput, StatusItemDto, CriarPedidoInput, PedidoConfirmadoDto, ProdutoResumoDto, CategoriaCardapio, PedidosComandaEventoDto } from '@restaurante/contracts';
export interface ApiRequest { path: string; method: string; body?: unknown; sessionToken?: string; idempotencyKey?: string }
export interface ApiResult { status: number; data?: unknown }
export type ApiTransport = (request: ApiRequest) => Promise<ApiResult>;
export interface AcompanharPedidosCallbacks {
  pedidos: (pedidos: PedidoConfirmadoDto[]) => void;
  conexao?: (status: 'conectando' | 'conectado' | 'reconectando', message?: string) => void;
}
declare global { interface Window { restaurante?: { request: ApiTransport; mesaId?: number; painel?: () => Promise<{ apiUrl: string }> } } }
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
    fila: (setor: SetorOperacional) => request<ItemFilaDto[]>('/' + setor.toLowerCase() + '/itens'),
    avancarStatus: (setor: SetorOperacional, idItem: number, input: AlterarStatusItemInput) => request<StatusItemDto>('/' + setor.toLowerCase() + '/itens/' + idItem + '/status', 'PATCH', input),
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
    sair: (token: string) => request<void>('/acessos/mesa', 'DELETE', undefined, token),
    categoriasCardapio: (token: string) => request<CategoriaCardapio[]>('/cardapio/categorias', 'GET', undefined, token),
    produtosCardapio: (token: string, categoria?: CategoriaCardapio) => request<ProdutoResumoDto[]>('/cardapio/produtos' + (categoria ? '?categoria=' + categoria : ''), 'GET', undefined, token),
    detalheProduto: (token: string, idProduto: number) => request<ProdutoResumoDto>('/cardapio/produtos/' + idProduto, 'GET', undefined, token),
    confirmarPedido: (idComanda: number, input: CriarPedidoInput, token: string, key: string) => request<PedidoConfirmadoDto>('/atendimentos/' + idComanda + '/pedidos', 'POST', input, token, key),
    pedidosComanda: (idComanda: number, token: string) => request<PedidoConfirmadoDto[]>('/atendimentos/' + idComanda + '/pedidos', 'GET', undefined, token),
    acompanharPedidosComanda: (idComanda: number, token: string, callbacks: AcompanharPedidosCallbacks) => {
      let stopped = false, revision = 0;
      let abortController: AbortController | undefined;
      let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
      const notifyConexao = (status: 'conectando' | 'conectado' | 'reconectando', message?: string) => {
        if (!stopped) callbacks.conexao?.(status, message);
      };
      const loadSnapshot = async () => {
        const current = ++revision;
        try {
          const lista = await request<PedidoConfirmadoDto[]>('/atendimentos/' + idComanda + '/pedidos', 'GET', undefined, token);
          if (!stopped && current === revision && Array.isArray(lista)) {
            callbacks.pedidos(lista);
            notifyConexao('conectado');
          }
        } catch (e) {
          if (!stopped && current === revision) {
            notifyConexao('reconectando', e instanceof Error ? e.message : 'Conexão interrompida. Tentando reconectar…');
          }
        }
      };
      const scheduleReconnect = (delayMs = 3000) => {
        if (stopped) return;
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => { if (!stopped) void connectStream(); }, delayMs);
      };
      const connectStream = async () => {
        if (stopped) return;
        abortController?.abort();
        const controller = new AbortController();
        abortController = controller;
        void loadSnapshot();
        try {
          const response = await fetch(base + '/atendimentos/' + idComanda + '/eventos', {
            method: 'GET',
            headers: { Accept: 'text/event-stream', Authorization: 'Bearer ' + token },
            signal: controller.signal
          });
          if (!response.ok || !response.body) {
            notifyConexao('reconectando', 'Conexão interrompida. Tentando reconectar…');
            scheduleReconnect(3000);
            return;
          }
          notifyConexao('conectado');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (!stopped) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let boundary: number;
            while ((boundary = buffer.indexOf('\n\n')) >= 0) {
              const frame = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              if (frame.includes('event: pedidos')) {
                const dataLine = frame.split('\n').find(l => l.startsWith('data: '));
                if (dataLine) {
                  try {
                    const parsed = JSON.parse(dataLine.slice(6)) as PedidosComandaEventoDto;
                    if (Array.isArray(parsed.pedidos)) {
                      revision++;
                      if (!stopped) {
                        callbacks.pedidos(parsed.pedidos);
                        notifyConexao('conectado');
                      }
                    }
                  } catch { /* ignora frame inválido */ }
                }
              } else if (frame.includes('event: indisponivel')) {
                revision++;
                notifyConexao('reconectando', 'Acompanhamento indisponível. Aguardando o servidor…');
              }
            }
          }
          if (!stopped) {
            notifyConexao('reconectando', 'Conexão interrompida. Tentando reconectar…');
            scheduleReconnect(3000);
          }
        } catch {
          if (!stopped) {
            notifyConexao('reconectando', 'Conexão interrompida. Tentando reconectar…');
            scheduleReconnect(3000);
          }
        }
      };
      notifyConexao('conectando');
      void connectStream();
      return () => {
        stopped = true;
        revision++;
        clearTimeout(reconnectTimer);
        abortController?.abort();
      };
    }
  };
}
