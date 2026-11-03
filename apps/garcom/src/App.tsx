import { useState } from 'react';

type Chamada = { mesa: number; horario: string; minutos: number };
type ItemPronto = { id: number; mesa: number; comanda: string; pedido: string; nome: string; quantidade: number; setor: 'Cozinha' | 'Bar'; minutos: number };

const chamadasDeExemplo: Chamada[] = [
  { mesa: 3, horario: '18:34', minutos: 18 },
  { mesa: 8, horario: '18:42', minutos: 10 }
];
const itensDeExemplo: ItemPronto[] = [
  { id: 5801, mesa: 8, comanda: '001', pedido: '5801', nome: 'Filé ao molho', quantidade: 2, setor: 'Cozinha', minutos: 8 },
  { id: 5802, mesa: 8, comanda: '001', pedido: '5801', nome: 'Suco de laranja', quantidade: 2, setor: 'Bar', minutos: 4 }
];

function IconeMarca() { return <span className="brand-mark" aria-hidden="true">M</span>; }
function IconeRelogio() { return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.25"/><path d="M10 5.8v4.6l3 1.8"/></svg>; }
function IconeSeta() { return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg>; }

export function App() {
  const preview = new URLSearchParams(window.location.search).get('preview') === '1';
  const chamadas = preview ? chamadasDeExemplo : [];
  const itens = preview ? itensDeExemplo : [];
  const [notice, setNotice] = useState('');
  const cozinha = itens.filter(item => item.setor === 'Cozinha');
  const bar = itens.filter(item => item.setor === 'Bar');

  function informarAcaoVisual() {
    setNotice('A API da Sprint 3 ainda não está conectada. Nenhuma alteração foi enviada.');
  }

  return <div className="waiter-app">
    <header className="waiter-header">
      <div className="waiter-brand"><IconeMarca /><h1>Garçom</h1></div>
      <span className="mobile-label">Atendimento</span>
    </header>
    <main className="waiter-main">
      <p className="preview-note" role="note">
        {preview ? 'Prévia visual · dados ilustrativos, não persistidos' : 'Interface pronta · integração da Sprint 3 pendente'}
      </p>

      <div className="waiter-counts" aria-label="Resumo de pendências">
        <div className="count-card call-count"><span>Chamados</span><strong>{chamadas.length}</strong></div>
        <div className="count-card ready-count"><span>Pedidos prontos</span><strong>{itens.length}</strong></div>
      </div>

      {notice && <p className="action-notice" role="status">{notice}</p>}

      <section className="waiter-section" aria-labelledby="calls-heading">
        <div className="section-heading"><div><p className="section-kicker">Solicitações</p><h2 id="calls-heading">Chamados</h2></div><span className="section-count">{chamadas.length}</span></div>
        {chamadas.length === 0 ? <div className="empty-card"><h3>Nenhuma mesa chamando no momento.</h3><p>Novos chamados aparecerão aqui automaticamente.</p></div> :
          <div className="card-list">{chamadas.map(chamada => <article className="waiter-card call-card" key={chamada.mesa}>
            <div className="card-topline"><span className="table-number">Mesa {String(chamada.mesa).padStart(2, '0')}</span><IconeSeta /></div>
            <span className="wait-time"><IconeRelogio /> há {chamada.minutos} min</span>
            <h3>Solicitou atendimento</h3>
            <p className="card-time">{chamada.horario} · aguardando {chamada.minutos} min</p>
            <button className="primary-button" onClick={informarAcaoVisual}>Concluir atendimento</button>
          </article>)}</div>}
      </section>

      <section className="waiter-section ready-section" aria-labelledby="ready-heading">
        <div className="section-heading"><div><p className="section-kicker">Retirada</p><h2 id="ready-heading">Pedidos prontos</h2></div><span className="section-count blue-count">{itens.length}</span></div>
        <ReadyGroup title="Cozinha" items={cozinha} preview={preview} onAction={informarAcaoVisual} />
        <ReadyGroup title="Bar" items={bar} preview={preview} onAction={informarAcaoVisual} />
      </section>
    </main>
  </div>;
}

function ReadyGroup({ title, items, preview, onAction }: { title: string; items: ItemPronto[]; preview: boolean; onAction: () => void }) {
  return <section className="sector-group" aria-label={'Itens prontos da ' + title}>
    <div className="sector-heading"><h3>{title}</h3><span>{items.length} {items.length === 1 ? 'item' : 'itens'}</span></div>
    {items.length === 0 ? <div className="empty-card small-empty"><h4>Nenhum item pronto {title === 'Bar' ? 'no bar' : 'na cozinha'}.</h4><p>Itens em preparo não aparecem na retirada.</p></div> :
      <div className="card-list">{items.map(item => <article className="waiter-card ready-card" key={item.id}>
        <p className="order-meta">Mesa {String(item.mesa).padStart(2, '0')} · Comanda {item.comanda} · Pedido {item.pedido}</p>
        <div className="product-line"><span className="check-mark" aria-hidden="true">✓</span><h4>{item.quantidade} × {item.nome}</h4></div>
        <p className="sector-name">{item.setor}</p>
        <span className="ready-time">pronto há {item.minutos} min</span>
        <button className="primary-button" onClick={onAction}>{preview ? 'Marcar como entregue' : 'Marcar como entregue'}</button>
      </article>)}</div>}
  </section>;
}
