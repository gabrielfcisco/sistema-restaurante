import { useEffect, useRef, useState } from 'react';
import type { AlterarStatusItemInput, ItemFilaDto, SetorOperacional, StatusFila, StatusItemDto } from '@restaurante/contracts';
import { Button } from './index';

interface ClienteFila {
  listar(): Promise<ItemFilaDto[]>;
  avancar(id: number, input: AlterarStatusItemInput): Promise<StatusItemDto>;
  acompanhar(callbacks: { itens: (itens: ItemFilaDto[]) => void; conexao: (status: 'conectando' | 'conectado' | 'reconectando', message?: string) => void }): () => void;
}
const columns: { status: StatusFila; title: string; action: string; next: AlterarStatusItemInput['status'] }[] = [
  { status: 'RECEBIDO', title: 'Recebidos', action: 'Iniciar preparo', next: 'EM_PREPARO' },
  { status: 'EM_PREPARO', title: 'Em preparo', action: 'Marcar como pronto', next: 'PRONTO' },
  { status: 'PRONTO', title: 'Prontos', action: 'Marcar como entregue', next: 'ENTREGUE' }
];
export function PainelOperacional({ setor, cliente }: { setor: SetorOperacional; cliente: ClienteFila }) {
  const title = setor === 'COZINHA' ? 'Cozinha' : 'Bar';
  const [itens, setItens] = useState<ItemFilaDto[]>([]), [loaded, setLoaded] = useState(false);
  const [connection, setConnection] = useState<'conectando' | 'conectado' | 'reconectando'>('conectando');
  const [connectionError, setConnectionError] = useState(''), [actionError, setActionError] = useState('');
  const [filter, setFilter] = useState<StatusFila | ''>(''), [now, setNow] = useState(Date.now()), [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<Set<number>>(new Set()), [feedback, setFeedback] = useState('');
  const locks = useRef(new Set<number>()), mounted = useRef(false), dataVersion = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const cancel = cliente.acompanhar({
      itens: data => { dataVersion.current++; setItens(data); setLoaded(true); },
      conexao: (status, message) => { setConnection(status); setConnectionError(message ?? ''); }
    });
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => { mounted.current = false; cancel(); clearInterval(timer); };
  }, [cliente, reload]);
  async function avancar(item: ItemFilaDto, next: AlterarStatusItemInput['status']) {
    if (locks.current.has(item.idItem) || connection !== 'conectado') return;
    locks.current.add(item.idItem); setBusy(new Set(locks.current)); setActionError(''); setFeedback('');
    try {
      const result = await cliente.avancar(item.idItem, { statusAtual: item.status, status: next });
      if (mounted.current) {
        // Só atualiza a versão ainda exibida; um snapshot SSE mais novo prevalece.
        setItens(current => current.flatMap(i => i.idItem !== item.idItem ? [i] : i.status !== item.status ? [i]
          : result.status === 'ENTREGUE' ? [] : [{ ...i, status: result.status } as ItemFilaDto]));
        setFeedback('Item #' + item.idItem + ' atualizado.');
      }
    } catch (e) {
      if (!mounted.current) return;
      setActionError(e instanceof Error ? e.message : 'Não foi possível atualizar este item.');
      const version = dataVersion.current;
      try { const data = await cliente.listar(); if (mounted.current && dataVersion.current === version) { dataVersion.current++; setItens(data); } }
      catch { if (mounted.current) { setConnection('reconectando'); setConnectionError('Não foi possível atualizar a fila. Aguardando reconexão.'); } }
    } finally { locks.current.delete(item.idItem); if (mounted.current) setBusy(new Set(locks.current)); }
  }
  return <div className="operational-board">
    <header className="operation-header"><div className="operation-brand"><span aria-hidden="true" className="operation-mark">M</span><h1>{title}</h1></div><span role="status" className={'connection-badge ' + connection}>{connection === 'conectado' ? 'Atualizado' : connection === 'conectando' ? 'Conectando…' : 'Reconectando…'}</span></header>
    <main>
      <div className="operation-toolbar"><span className="sector-badge">{title} vê somente seus itens</span><span className="operation-subtitle">Pedidos por ordem de chegada</span><div className="operation-controls"><label htmlFor="status-fila" className="sr-only">Filtrar por status</label><select id="status-fila" value={filter} onChange={e => setFilter(e.target.value as StatusFila | '')}><option value="">Todos os status</option>{columns.map(c => <option key={c.status} value={c.status}>{c.title}</option>)}</select><Button className="operation-refresh" onClick={() => setReload(n => n + 1)}>Atualizar</Button></div></div>
      {connectionError && <p className="operation-notice" role="alert">{connectionError} As ações ficam pausadas até a conexão voltar.</p>}
      {actionError && <p className="operation-notice operation-error" role="alert">{actionError}</p>}
      <span className="sr-only" role="status">{feedback}</span>
      <div className={'operation-columns' + (filter ? ' filtered' : '')}>{columns.filter(c => !filter || c.status === filter).map(column => {
        const rows = itens.filter(i => i.status === column.status);
        return <section key={column.status} className={'operation-column ' + column.status.toLowerCase()} aria-labelledby={'column-' + column.status}>
          <div className="column-heading"><h2 id={'column-' + column.status}>{column.title}</h2><span className="column-count">{rows.length} {rows.length === 1 ? 'item' : 'itens'}</span></div>
          {rows.length === 0 && <p className="operation-empty">{loaded ? 'Nenhum item nesta etapa.' : connection === 'reconectando' ? 'Aguardando conexão para carregar os pedidos.' : 'Carregando pedidos…'}</p>}
          {rows.map(item => {
            const minutes = Math.max(0, Math.floor((now - Date.parse(item.dataHora)) / 60000));
            const time = new Date(item.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return <article key={item.idItem} className="operation-card" aria-label={'Item ' + item.idItem + ': ' + item.nomeProduto} data-item-id={item.idItem}>
              <h3>{item.quantidade}× {item.nomeProduto}</h3>
              <p className="operation-meta">Mesa {String(item.numeroMesa).padStart(2, '0')} · Comanda #{item.idComanda}</p>
              <p className="operation-meta">Pedido #{item.idPedido} · <time dateTime={item.dataHora} title={new Date(item.dataHora).toLocaleString('pt-BR')}>{time}</time> · espera {minutes} min</p>
              {item.observacao && <p className="operation-observation"><strong>Observação:</strong> {item.observacao}</p>}
              <div className="operation-tags"><span className={'item-status ' + column.status.toLowerCase()}>{column.title}</span>{minutes >= 20 && <span className="item-overdue">Acima de 20 min</span>}</div>
              <Button className="operation-action" disabled={busy.has(item.idItem) || connection !== 'conectado'} onClick={() => void avancar(item, column.next)}>{busy.has(item.idItem) ? 'Atualizando…' : column.action}</Button>
            </article>;
          })}
        </section>;
      })}</div>
    </main>
  </div>;
}
