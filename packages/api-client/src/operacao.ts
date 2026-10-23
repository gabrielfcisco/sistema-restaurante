import type { AlterarStatusItemInput, FilaEventoDto, ItemFilaDto, SetorOperacional } from '@restaurante/contracts';
import { createApiClient } from './index';

export type ConexaoFila = 'conectando' | 'conectado' | 'reconectando';
export interface FilaCallbacks { itens: (itens: ItemFilaDto[]) => void; conexao: (status: ConexaoFila, message?: string) => void }
export function ordenarFila(itens: ItemFilaDto[]) {
  return [...itens].sort((a, b) => Date.parse(a.dataHora) - Date.parse(b.dataHora) || a.idPedido - b.idPedido || a.idItem - b.idItem);
}
export function criarClienteOperacional(baseUrl: string, setor: SetorOperacional) {
  const api = createApiClient(baseUrl);
  function validar(itens: ItemFilaDto[]) {
    if (!Array.isArray(itens) || itens.some(i => !i || i.setor !== setor || !['RECEBIDO', 'EM_PREPARO', 'PRONTO'].includes(i.status)
      || !Number.isSafeInteger(i.idItem) || !Number.isSafeInteger(i.idPedido) || !Number.isSafeInteger(i.idComanda)
      || !Number.isSafeInteger(i.numeroMesa) || !Number.isInteger(i.quantidade) || i.quantidade < 1 || typeof i.nomeProduto !== 'string'
      || !Number.isFinite(Date.parse(i.dataHora)))) throw new Error('Resposta da fila inválida. Tente atualizar o painel.');
    return ordenarFila(itens);
  }
  return {
    async listar() { return validar(await api.fila(setor)); },
    avancar: (id: number, input: AlterarStatusItemInput) => api.avancarStatus(setor, id, input),
    acompanhar(callbacks: FilaCallbacks) {
      let stopped = false, stream: EventSource | undefined, revision = 0;
      const fail = (message?: string) => { if (!stopped) callbacks.conexao('reconectando', message ?? 'Conexão interrompida. Tentando reconectar…'); };
      const load = async () => {
        const current = ++revision;
        try {
          const itens = validar(await api.fila(setor));
          if (!stopped && current === revision) { callbacks.itens(itens); callbacks.conexao('conectado'); }
        } catch (e) { if (current === revision) fail(e instanceof Error ? e.message : undefined); }
      };
      callbacks.conexao('conectando');
      const start = async () => {
        try {
          const config = typeof window !== 'undefined' ? await window.restaurante?.painel?.() : undefined;
          if (stopped) return;
          const base = (config?.apiUrl ?? baseUrl).replace(/\/$/, '');
          stream = new EventSource(base + '/' + setor.toLowerCase() + '/eventos');
          stream.onopen = () => { void load(); };
          stream.onerror = () => { revision++; fail(); };
          stream.addEventListener('fila', event => {
            try {
              const itens = validar((JSON.parse((event as MessageEvent).data) as FilaEventoDto).itens);
              revision++;
              if (!stopped) { callbacks.itens(itens); callbacks.conexao('conectado'); }
            } catch (e) { fail(e instanceof Error ? e.message : undefined); }
          });
          stream.addEventListener('indisponivel', () => { revision++; fail('Fila indisponível. Aguardando o servidor…'); });
          void load();
        } catch (e) { fail(e instanceof Error ? e.message : undefined); }
      };
      void start();
      return () => { stopped = true; revision++; stream?.close(); };
    }
  };
}
