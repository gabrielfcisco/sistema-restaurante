import type { ItemFilaDto, PedidoConfirmadoDto } from '@restaurante/contracts';
import type { OperacaoService, CanalFila } from './service';
import type { SprintService } from '../sprint-service';

type Listener = (itens: ItemFilaDto[] | null) => void;
type ComandaListener = (pedidos: PedidoConfirmadoDto[] | null) => void;
export class FilaFeed {
  private channels = new Map<CanalFila, { listeners: Set<Listener>; timer: ReturnType<typeof setInterval>; fingerprint?: string; reading?: Promise<void>; again: boolean }>();
  private comandaChannels = new Map<number, { listeners: Set<{ token: string; listener: ComandaListener; fingerprint?: string }>; timer: ReturnType<typeof setInterval>; fingerprint?: string; reading?: Promise<void>; again: boolean }>();
  constructor(private service: OperacaoService, private intervalMs = 2000, private sprintService?: SprintService) {}
  subscribe(setor: CanalFila, listener: Listener) {
    let channel = this.channels.get(setor);
    if (!channel) {
      const timer = setInterval(() => { void this.refresh(setor); }, this.intervalMs);
      timer.unref();
      channel = { listeners: new Set(), timer, again: false };
      this.channels.set(setor, channel);
    }
    channel.listeners.add(listener);
    // Cada conexão obtém snapshot fresco, mesmo sem mudança desde a anterior.
    channel.fingerprint = undefined;
    void this.refresh(setor);
    return () => {
      const current = this.channels.get(setor);
      if (!current) return;
      current.listeners.delete(listener);
      if (!current.listeners.size) { clearInterval(current.timer); this.channels.delete(setor); }
    };
  }
  subscribeComanda(idComanda: number, token: string, listener: ComandaListener) {
    let channel = this.comandaChannels.get(idComanda);
    if (!channel) {
      const timer = setInterval(() => { void this.refreshComanda(idComanda); }, this.intervalMs);
      timer.unref();
      channel = { listeners: new Set(), timer, again: false };
      this.comandaChannels.set(idComanda, channel);
    }
    const entry = { token, listener };
    channel.listeners.add(entry);
    channel.fingerprint = undefined;
    void this.refreshComanda(idComanda);
    return () => {
      const current = this.comandaChannels.get(idComanda);
      if (!current) return;
      current.listeners.delete(entry);
      if (!current.listeners.size) { clearInterval(current.timer); this.comandaChannels.delete(idComanda); }
    };
  }
  async refresh(setor: CanalFila): Promise<void> {
    const channel = this.channels.get(setor);
    if (!channel) return;
    if (channel.reading) { channel.again = true; return channel.reading; }
    channel.reading = (async () => {
      try {
        const itens = await this.service.listar(setor);
        const fingerprint = JSON.stringify(itens);
        if (channel.fingerprint !== fingerprint) {
          channel.fingerprint = fingerprint;
          for (const listener of channel.listeners) listener(itens);
        }
      } catch {
        channel.fingerprint = undefined;
        for (const listener of channel.listeners) listener(null);
      } finally { channel.reading = undefined; }
    })();
    await channel.reading;
    if (channel.again && this.channels.get(setor) === channel) { channel.again = false; await this.refresh(setor); }
  }
  async refreshComanda(idComanda: number): Promise<void> {
    const channel = this.comandaChannels.get(idComanda);
    const sprint = this.sprintService;
    if (!channel || !sprint) return;
    if (channel.reading) { channel.again = true; return channel.reading; }
    channel.reading = (async () => {
      try {
        // Revalida cada sessão antes de transmitir mudanças, inclusive após revogação.
        await Promise.all([...channel.listeners].map(async entry => {
          try {
            const pedidos = await sprint.listarPedidosComanda(idComanda, entry.token);
            const fingerprint = JSON.stringify(pedidos);
            if (entry.fingerprint !== fingerprint && channel.listeners.has(entry)) {
              entry.fingerprint = fingerprint;
              entry.listener(pedidos);
            }
          } catch {
            entry.fingerprint = undefined;
            if (channel.listeners.has(entry)) entry.listener(null);
          }
        }));
      } catch {
        channel.fingerprint = undefined;
        for (const entry of channel.listeners) entry.listener(null);
      } finally { channel.reading = undefined; }
    })();
    await channel.reading;
    if (channel.again && this.comandaChannels.get(idComanda) === channel) { channel.again = false; await this.refreshComanda(idComanda); }
  }
  async refreshAllComandas(): Promise<void> {
    await Promise.all([...this.comandaChannels.keys()].map(idComanda => this.refreshComanda(idComanda)));
  }
}
