import type { ItemFilaDto, SetorOperacional } from '@restaurante/contracts';
import type { OperacaoService } from './service';

type Listener = (itens: ItemFilaDto[] | null) => void;
export class FilaFeed {
  private channels = new Map<SetorOperacional, { listeners: Set<Listener>; timer: ReturnType<typeof setInterval>; fingerprint?: string; reading?: Promise<void>; again: boolean }>();
  constructor(private service: OperacaoService, private intervalMs = 2000) {}
  subscribe(setor: SetorOperacional, listener: Listener) {
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
  async refresh(setor: SetorOperacional): Promise<void> {
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
}
