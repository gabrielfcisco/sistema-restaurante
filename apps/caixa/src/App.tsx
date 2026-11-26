import { Historico } from './Historico';
import { Button } from '@restaurante/ui';
import { acompanharContas, ApiError, createApiClient } from '@restaurante/api-client';
import { FORMAS_PAGAMENTO, type ContaCaixaDto, type ContaResumoDto, type PagamentoDto, type TaxaInput } from '@restaurante/contracts';
import { useEffect, useRef, useState } from 'react';
const base = window.caixaApiUrl || import.meta.env.VITE_API_URL || 'http://127.0.0.1:3333/api';
const api = createApiClient(base);
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
declare global { interface Window { caixaApiUrl?: string; caixaDocumento?: (action: 'imprimir' | 'pdf', idPreconta: number) => Promise<{ cancelado?: boolean }> } }
export function App() {
  const [contas, setContas] = useState<ContaResumoDto[]>([]), [id, setId] = useState<number | null>(null), [conta, setConta] = useState<ContaCaixaDto | null>(null);
  const [conectado, setConectado] = useState(false), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [taxas, setTaxas] = useState<TaxaInput[]>([]), [taxa, setTaxa] = useState<TaxaInput>({ nome: '', tipo: 'PERCENTUAL', valor: 0 });
  const [confirmar, setConfirmar] = useState<number | null>(null), [recebido, setRecebido] = useState(false), [resultado, setResultado] = useState<PagamentoDto | null>(null);
  const [taxasAlteradas, setTaxasAlteradas] = useState(false);
  const generation = useRef(0), lock = useRef(false);
  useEffect(() => acompanharContas<ContaResumoDto[]>(base, '/caixa/eventos', setContas, setConectado), []);
  useEffect(() => {
    if (id === null) return;
    const current = ++generation.current; let reading = false, inicial = true;
    const load = async () => {
      if (lock.current || reading) return; reading = true;
      try { const value = await api.contaCaixa(id); if (current === generation.current && !lock.current) { setConta(value); setLoading(false); if (inicial) { setTaxas(value.preconta?.taxas.map(({ nome, tipo, valor }) => ({ nome, tipo, valor })) ?? []); inicial = false; } } }
      catch (e) { if (current === generation.current && !lock.current) { setMessage(e instanceof Error ? e.message : 'Não foi possível consultar a conta.'); setLoading(false); if (e instanceof ApiError && e.status === 409) { setConta(null); setConfirmar(null); } } }
      finally { reading = false; }
    };
    void load(); const timer = setInterval(() => void load(), 2000);
    return () => { generation.current++; clearInterval(timer); };
  }, [id]);
  function selecionar(value: string) { setId(value ? Number(value) : null); setConta(null); setTaxas([]); setTaxasAlteradas(false); setConfirmar(null); setRecebido(false); setMessage(''); setLoading(!!value); }
  async function acao(tipo: 'emitir' | 'chamar' | 'pagar' | 'imprimir' | 'pdf') {
    if (!id || !conta || lock.current) return;
    lock.current = true; setBusy(true); setMessage(''); const p = conta.preconta;
    try {
      if (tipo === 'emitir') { const documento = await api.emitirPreconta(id, taxas); setConta({ ...conta, preconta: documento }); setTaxasAlteradas(false); setConfirmar(null); setMessage('Pré-conta emitida. Confira antes de cobrar.'); }
      else if (tipo === 'chamar' && p) { await api.chamarCobranca(id, p.idPreconta); setMessage('Garçom avisado para levar esta pré-conta e receber na mesa.'); }
      else if (tipo === 'pagar' && p && confirmar === p.idPreconta && recebido) { const r = await api.pagar(id, confirmar); setResultado(r); setConta(null); setId(null); setConfirmar(null); setContas(rows => rows.filter(c => c.idComanda !== id)); setMessage('Pagamento registrado.'); }
      else if ((tipo === 'imprimir' || tipo === 'pdf') && p) { if (window.caixaDocumento) { const r = await window.caixaDocumento(tipo, p.idPreconta); if (!r.cancelado) setMessage(tipo === 'pdf' ? 'PDF salvo.' : 'Pré-conta enviada para impressão.'); } else window.print(); }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível concluir a operação.'); setConfirmar(null); setRecebido(false); try { setConta(await api.contaCaixa(id)); } catch { setConta(null); } }
    finally { lock.current = false; setBusy(false); }
  }
  const p = conta?.preconta;
  return <div className="caixa-app">
    <header className="caixa-topbar"><div className="caixa-brand"><span className="caixa-mark" aria-hidden="true">M</span><h1>Caixa</h1></div><span className="caixa-badge" role="status">{conectado ? 'Contas atualizadas' : 'Conectando…'}</span></header>
    <main className="caixa-main">
      {message && <p className="preview-notice" role="status">{message}</p>}{!conectado && <p role="alert">Aguardando conexão. Ações de cobrança temporariamente bloqueadas.</p>}
      <div className="caixa-grid">
        <section className="caixa-card"><h2>Aguardando pagamento</h2><label htmlFor="comanda-caixa">Selecione uma comanda</label><select id="comanda-caixa" value={id ?? ''} disabled={busy || !conectado} onChange={e => selecionar(e.target.value)}><option value="">Selecionar comanda</option>{contas.map(c => <option value={c.idComanda} key={c.idComanda}>Comanda #{c.idComanda} · Mesa {c.numeroMesa} · {c.nomeCliente}</option>)}</select>{conectado && !contas.length && <p>Nenhuma comanda aguardando pagamento.</p>}<p>Somente contas solicitadas pelos clientes aparecem nesta lista.</p></section>
        <section className="caixa-card"><h2>Conferência</h2>{loading ? <p role="status">Carregando conta…</p> : !conta ? <p>Selecione uma comanda para conferir os itens.</p> : <><p>Comanda #{conta.idComanda} · Mesa {conta.numeroMesa} · {conta.nomeCliente}</p><ul className="caixa-itens">{conta.itens.map(i => <li key={i.idItem}><span>{i.quantidade}× {i.nomeProduto}<small>{moeda(i.precoUnitario)} / un. · {i.status === 'ENTREGUE' ? 'Entregue' : 'Entrega pendente'}</small></span><strong>{moeda(i.subtotal)}</strong></li>)}</ul>{!conta.itens.length && <p>Nenhum pedido confirmado.</p>}<div className="caixa-total"><span>Consumo</span><strong>{moeda(conta.subtotal)}</strong></div><p>Forma informada: {conta.formaPagamento ? FORMAS_PAGAMENTO[conta.formaPagamento] : 'Não informada'}</p></>}</section>
      </div>
      {conta && <>
        <section className="caixa-card"><h2>Taxas da pré-conta</h2><p>Nenhuma taxa é aplicada automaticamente. Cada percentual incide somente sobre o consumo.</p>
          <form onSubmit={e => { e.preventDefault(); setTaxas(rows => [...rows, taxa]); setTaxasAlteradas(true); setTaxa({ nome: '', tipo: 'PERCENTUAL', valor: 0 }); setConfirmar(null); }}><fieldset disabled={busy || !conectado || taxas.length >= 20}><legend>Adicionar taxa</legend><label>Nome<input required maxLength={120} value={taxa.nome} onChange={e => setTaxa({ ...taxa, nome: e.target.value })} /></label><div className="caixa-fields"><label>Tipo<select value={taxa.tipo} onChange={e => setTaxa({ ...taxa, tipo: e.target.value as TaxaInput['tipo'] })}><option value="PERCENTUAL">Percentual do consumo</option><option value="FIXA">Valor fixo em reais</option></select></label><label>Valor<input required type="number" min="0" step="0.01" max={taxa.tipo === 'PERCENTUAL' ? 100 : 99999999.99} value={taxa.valor} onChange={e => setTaxa({ ...taxa, valor: Number(e.target.value) })} /></label></div><Button className="acao acao-secundaria">Adicionar taxa</Button></fieldset></form>
          <ul className="caixa-itens">{taxas.map((t, n) => <li key={n}><span>{t.nome} · {t.tipo === 'PERCENTUAL' ? t.valor + '%' : moeda(t.valor)}</span><Button className="acao acao-secundaria" disabled={busy} onClick={() => { setTaxas(rows => rows.filter((_, i) => i !== n)); setTaxasAlteradas(true); setConfirmar(null); }}>Remover</Button></li>)}</ul>
          <Button className="acao" disabled={busy || !conectado || !conta.formaPagamento} onClick={() => void acao('emitir')}>{busy ? 'Processando…' : p ? 'Emitir nova versão da pré-conta' : 'Emitir pré-conta'}</Button>
        </section>
        {taxasAlteradas && <p role="status">As taxas foram alteradas no rascunho. Emita uma nova pré-conta antes de cobrar.</p>}{p && <section className="caixa-card preconta" aria-label="Pré-conta emitida"><h2>Pré-conta #{p.idPreconta}</h2><p>Documento de conferência · Sem valor fiscal · Ainda não pago</p><p>{new Date(p.criadaEm).toLocaleString('pt-BR')} · Mesa {p.numeroMesa} · Comanda #{p.idComanda} · {p.nomeCliente}</p><ul className="caixa-itens">{p.itens.map(i => <li key={i.idItem}><span>{i.quantidade}× {i.nomeProduto} · {moeda(i.precoUnitario)} / un.</span><strong>{moeda(i.subtotal)}</strong></li>)}</ul><div className="caixa-total"><span>Consumo</span><strong>{moeda(p.subtotal)}</strong></div><ul className="caixa-itens">{p.taxas.map((t, i) => <li key={i}><span>{t.nome}{t.tipo === 'PERCENTUAL' ? ' (' + t.valor + '%)' : ''}</span><strong>{moeda(t.total)}</strong></li>)}</ul><div className="caixa-total"><span>Total da pré-conta</span><strong>{moeda(p.total)}</strong></div><p>Forma: {p.formaPagamento && FORMAS_PAGAMENTO[p.formaPagamento]}</p>
          <div className="caixa-actions"><Button className="acao acao-secundaria" disabled={busy} onClick={() => void acao('imprimir')}>Imprimir</Button><Button className="acao acao-secundaria" disabled={busy} onClick={() => void acao('pdf')}>Baixar PDF</Button><Button className="acao" disabled={busy || !conectado || taxasAlteradas} onClick={() => void acao('chamar')}>Chamar garçom para receber</Button></div>
          {!conta.todosEntregues && <p role="status">Pagamento bloqueado até a entrega de todos os itens.</p>}
          {confirmar === p.idPreconta ? <div className="caixa-card"><h3>Confirmar recebimento de {moeda(p.total)}?</h3><label><input type="checkbox" checked={recebido} onChange={e => setRecebido(e.target.checked)} /> Conferi o retorno do garçom e o recebimento integral em {p.formaPagamento && FORMAS_PAGAMENTO[p.formaPagamento]}.</label><Button className="acao" disabled={busy || !conectado || taxasAlteradas || !recebido || !conta.todosEntregues} onClick={() => void acao('pagar')}>Confirmar quitação</Button><Button className="acao acao-secundaria" disabled={busy} onClick={() => setConfirmar(null)}>Cancelar</Button></div> : <Button className="acao" disabled={busy || !conectado || taxasAlteradas || !conta.todosEntregues} onClick={() => { setConfirmar(p.idPreconta); setRecebido(false); }}>Confirmar recebimento</Button>}
        </section>}
      </>}
      {resultado && <section className="caixa-card" role="status"><h2>Pagamento registrado #{resultado.idPagamento}</h2><p>Comanda #{resultado.idComanda} finalizada · {moeda(resultado.valor)} em {FORMAS_PAGAMENTO[resultado.forma]}</p><p>{resultado.mesaLiberada ? 'Mesa liberada para novo atendimento.' : 'Mesa permanece ocupada: há outras comandas ativas.'}</p><p>Histórico e documento de pagamento preservados.</p></section>}
      <Historico key={resultado?.idPagamento ?? 0} base={base} ultimoPagamento={resultado?.idPagamento} />
    </main>
  </div>;
}
