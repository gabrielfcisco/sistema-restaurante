import { useEffect, useRef, useState } from 'react';
import { createApiClient } from '@restaurante/api-client';
import { criarClienteOperacional } from '@restaurante/api-client/operacao';
import type { ChamadaDto, ComandaGarcomDto, ItemFilaDto, MesaGarcomDto } from '@restaurante/contracts';

const base = import.meta.env.VITE_API_URL ?? (window.location.protocol === 'file:' ? 'http://127.0.0.1:3333/api' : window.location.protocol + '//' + window.location.hostname + ':3333/api');
const api = createApiClient(base);
const fila = criarClienteOperacional(base, 'GARCOM');
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const status = { RECEBIDO: 'Recebido', EM_PREPARO: 'Em preparo', PRONTO: 'Pronto', ENTREGUE: 'Entregue' };

export function App() {
  const [itens, setItens] = useState<ItemFilaDto[]>([]);
  const [conexao, setConexao] = useState('conectando');
  const [chamados, setChamados] = useState<ChamadaDto[] | null>(null);
  const [concluindo, setConcluindo] = useState<number | null>(null);
  async function concluir(id: number) {
    setConcluindo(id); setAviso('');
    try { await api.concluirChamada(id); setChamados(rows => rows?.filter(c => c.idChamada !== id) ?? null); }
    catch (e) { setAviso(e instanceof Error ? e.message : 'Não foi possível concluir a chamada.'); }
    finally { setConcluindo(null); }
  }
  const [erroFila, setErroFila] = useState('');
  const [aviso, setAviso] = useState('');
  const [selecionado, setSelecionado] = useState<ItemFilaDto | null>(null);
  const [entregando, setEntregando] = useState(false);
  const [numero, setNumero] = useState('');
  const [mesa, setMesa] = useState<MesaGarcomDto | null>(null);
  const [comanda, setComanda] = useState<ComandaGarcomDto | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [erroConsulta, setErroConsulta] = useState('');
  const [reconectar, setReconectar] = useState(0);
  const versao = useRef(0), entregaLock = useRef(false), mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const stop = fila.acompanhar({ itens: setItens, chamados: setChamados, conexao: (value, message) => { setConexao(value); setErroFila(message ?? ''); } });
    return () => { mounted.current = false; versao.current++; stop(); };
  }, [reconectar]);

  async function buscar() {
    const atual = ++versao.current;
    setConsultando(true); setErroConsulta(''); setMesa(null); setComanda(null);
    try { const data = await api.buscarMesaGarcom(Number(numero)); if (atual === versao.current) setMesa(data); }
    catch (e) { if (atual === versao.current) setErroConsulta(e instanceof Error ? e.message : 'Não foi possível consultar a mesa.'); }
    finally { if (atual === versao.current) setConsultando(false); }
  }
  async function consultar(id: number) {
    const atual = ++versao.current;
    setConsultando(true); setErroConsulta(''); setComanda(null);
    try { const data = await api.comandaGarcom(id); if (atual === versao.current) setComanda(data); }
    catch (e) { if (atual === versao.current) setErroConsulta(e instanceof Error ? e.message : 'Não foi possível consultar a comanda.'); }
    finally { if (atual === versao.current) setConsultando(false); }
  }
  async function entregar() {
    if (!selecionado || entregaLock.current || conexao !== 'conectado') return;
    entregaLock.current = true; setEntregando(true); setAviso('');
    try {
      await api.entregarItem(selecionado.idItem);
      if (!mounted.current) return;
      setItens(atual => atual.filter(i => i.idItem !== selecionado.idItem));
      setSelecionado(null); setAviso('Entrega confirmada.');
      if (comanda?.idComanda === selecionado.idComanda) void consultar(comanda.idComanda);
    } catch (e) {
      if (!mounted.current) return;
      setAviso(e instanceof Error ? e.message : 'Não foi possível confirmar a entrega.');
      setSelecionado(null); setReconectar(n => n + 1);
    } finally { entregaLock.current = false; if (mounted.current) setEntregando(false); }
  }
  return <div className="waiter-app">
    <header className="waiter-header"><div className="waiter-brand"><span className="brand-mark">M</span><h1>Garçom</h1></div><span className="mobile-label">Atendimento</span></header>
    <main className="waiter-main">
      <p role="status">{conexao === 'conectado' ? 'Retirada atualizada' : conexao === 'conectando' ? 'Carregando retirada…' : 'Reconectando…'}</p>
      {erroFila && <p role="alert" className="action-notice">{erroFila}</p>}
      {aviso && <p role="status" className="action-notice">{aviso}</p>}
      <section className="waiter-section"><h2>Chamados</h2>
        {chamados === null ? <p role="status">Aguardando atualização dos chamados…</p> : chamados.length === 0 ? <p className="empty-card">Nenhuma mesa chamando no momento.</p> :
          chamados.map(c => <article className="waiter-card" key={c.idChamada}><h3>Mesa {c.numeroMesa}</h3><p>Solicitou atendimento às {new Date(c.criadaEm).toLocaleTimeString('pt-BR')}</p><button className="acao primary-button" disabled={concluindo !== null} onClick={() => void concluir(c.idChamada)}>Concluir atendimento</button></article>)}
      </section>
      <section className="waiter-section" aria-labelledby="consulta-title">
        <h2 id="consulta-title">Consultar mesa</h2>
        <form className="waiter-card" onSubmit={e => { e.preventDefault(); void buscar(); }}>
          <label htmlFor="numero-mesa">Número da mesa</label>
          <input id="numero-mesa" type="number" min="1" max="4294967295" step="1" required value={numero} onChange={e => { versao.current++; setConsultando(false); setNumero(e.target.value); setMesa(null); setComanda(null); setErroConsulta(''); }} />
          <button className="acao primary-button" disabled={consultando}>Buscar mesa</button>
        </form>
        {consultando && <p role="status">Consultando…</p>}
        {erroConsulta && <p role="alert" className="action-notice">{erroConsulta}</p>}
        {mesa && <div className="waiter-card"><h3>Mesa {mesa.numeroMesa}</h3>
          {!mesa.comandas.length ? <p>Nenhuma comanda ativa nesta mesa.</p> : <><label htmlFor="comanda">Selecione uma comanda ativa</label><select id="comanda" value={comanda?.idComanda ?? ''} disabled={consultando} onChange={e => { if (e.target.value) void consultar(Number(e.target.value)); }}><option value="">Selecionar comanda</option>{mesa.comandas.map(c => <option key={c.idComanda} value={c.idComanda}>Comanda #{c.idComanda}</option>)}</select></>}
        </div>}
        {comanda && <article className="waiter-card"><h3>Comanda #{comanda.idComanda} · Mesa {comanda.numeroMesa}</h3>
          <button className="acao acao-secundaria" type="button" onClick={() => void consultar(comanda.idComanda)} disabled={consultando}>Atualizar consumo</button>
          {!comanda.pedidos.length && <p>Nenhum pedido confirmado.</p>}
          {comanda.pedidos.map(p => <section key={p.idPedido}><h4>Pedido #{p.idPedido} · {status[p.status]}</h4><ul>{p.itens.map(i => <li key={i.idItem}>{i.quantidade} × {i.nomeProduto} — {status[i.status]}<br />{moeda(i.precoUnitario)} por unidade · {moeda(i.subtotal)}</li>)}</ul></section>)}
          <p><strong>Total parcial: {moeda(comanda.total)}</strong></p>
        </article>}
      </section>
      <section className="waiter-section ready-section" aria-labelledby="retirada-title">
        <div className="section-heading"><h2 id="retirada-title">Pedidos prontos</h2><span className="section-count blue-count">{itens.length}</span></div>
        {selecionado ? <div className="waiter-card"><h3>Confirmar entrega</h3><p>Mesa {selecionado.numeroMesa} · Comanda #{selecionado.idComanda}</p><p>{selecionado.quantidade} × {selecionado.nomeProduto}</p><p>Confirme a entrega deste item ao cliente.</p><button className="acao primary-button" disabled={entregando || conexao !== 'conectado'} onClick={() => void entregar()}>{entregando ? 'Confirmando…' : 'Confirmar entrega'}</button><button className="acao acao-secundaria" disabled={entregando} onClick={() => setSelecionado(null)}>Voltar</button></div> :
          (['COZINHA', 'BAR'] as const).map(setor => <section className="sector-group" key={setor}><div className="sector-heading"><h3>{setor === 'BAR' ? 'Bar' : 'Cozinha'}</h3></div>
            {conexao === 'conectado' && !itens.some(i => i.setor === setor) && <p className="empty-card">Nenhum item pronto neste setor.</p>}
            <div className="card-list">{itens.filter(i => i.setor === setor).map(i => <article key={i.idItem} className="waiter-card ready-card"><p className="order-meta">Mesa {i.numeroMesa} · Comanda #{i.idComanda} · Pedido #{i.idPedido}</p><h4>{i.quantidade} × {i.nomeProduto}</h4>{i.observacao && <p>{i.observacao}</p>}<p className="ready-time">Pedido recebido em {new Date(i.dataHora).toLocaleString('pt-BR')}</p><button className="acao primary-button" disabled={conexao !== 'conectado'} onClick={() => setSelecionado(i)}>Marcar como entregue</button></article>)}</div>
          </section>)}
      </section>
    </main>
  </div>;
}
