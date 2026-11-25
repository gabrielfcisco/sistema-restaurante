// Snapshot completo em cada conexão: os avisos são persistidos, não eventos efêmeros.
export function acompanharContas<T>(base: string, path: '/caixa/eventos' | '/garcom/contas/eventos', update: (value: T) => void, conexao: (ok: boolean) => void) {
  let stopped = false, controller: AbortController | undefined, retry: ReturnType<typeof setTimeout> | undefined;
  const connect = async () => {
    controller = new AbortController(); conexao(false);
    try {
      const r = await fetch(base.replace(/\/$/, '') + path, { headers: { Accept: 'text/event-stream' }, signal: controller.signal });
      if (!r.ok || !r.body) throw new Error('Conexão indisponível');
      const reader = r.body.getReader(), decoder = new TextDecoder(); let buffer = '';
      try {
        while (!stopped) {
          const data = await reader.read(); if (data.done) break;
          buffer += decoder.decode(data.value, { stream: true });
          if (buffer.length > 2097152) throw new Error('Resposta inválida');
          let boundary: number;
          while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            const event = frame.split('\n').find(s => s.startsWith('event: '))?.slice(7);
            const value = frame.split('\n').find(s => s.startsWith('data: '))?.slice(6);
            if (event === 'contas' && value && !stopped) { update(JSON.parse(value) as T); conexao(true); }
            else if (event === 'indisponivel' && !stopped) conexao(false);
          }
        }
      } finally { await reader.cancel().catch(() => {}); }
    } catch { /* Reconcilia o snapshot ao reconectar. */ }
    if (!stopped) { conexao(false); retry = setTimeout(() => void connect(), 3000); }
  };
  void connect();
  return () => { stopped = true; controller?.abort(); clearTimeout(retry); };
}
