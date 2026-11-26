import { useEffect, useState } from 'react';
import { Button } from '@restaurante/ui';
import { createApiClient } from '@restaurante/api-client';
import { FORMAS_PAGAMENTO, type PagamentoResumoDto, type PagamentoDetalheDto } from '@restaurante/contracts';
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (v: string) => new Date(v).toLocaleString('pt-BR');
export function Historico({ base, ultimoPagamento }: { base: string; ultimoPagamento?: number }) {
  const [aberto, setAberto] = useState(false), [lista, setLista] = useState<PagamentoResumoDto[]>([]);
  const [cursor, setCursor] = useState<number | undefined>(), [mais, setMais] = useState(false), [loading, setLoading] = useState(false);
  const [id, setId] = useState<number | null>(null), [detalhe, setDetalhe] = useState<PagamentoDetalheDto | null>(null), [erro, setErro] = useState('');
  const [revisao, setRevisao] = useState(0), [erroDetalhe, setErroDetalhe] = useState('');
  useEffect(() => {
    if (!aberto) return; let ativo = true; setLoading(true); setErro('');
    void createApiClient(base).pagamentos(cursor).then(rows => { if (ativo) { setLista(old => cursor ? [...old, ...rows.filter(r => !old.some(p => p.idPagamento === r.idPagamento))] : rows); setMais(rows.length === 30); } }).catch(e => { if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar o histórico.'); }).finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [aberto, base, cursor, revisao, ultimoPagamento]);
  useEffect(() => {
    setDetalhe(null); setErroDetalhe(''); if (!aberto || id === null) return; let ativo = true;
    void createApiClient(base).pagamento(id).then(p => { if (ativo) setDetalhe(p); }).catch(e => { if (ativo) setErroDetalhe(e instanceof Error ? e.message : 'Não foi possível consultar o pagamento.'); });
    return () => { ativo = false; };
  }, [aberto, base, id, revisao]);
  return <section className="caixa-card historico"><h2>Histórico de pagamentos</h2>
    <Button className="acao acao-secundaria" aria-expanded={aberto} aria-controls="historico-pagamentos" onClick={() => { setAberto(!aberto); setCursor(undefined); setLista([]); setId(null); }}>{aberto ? 'Ocultar histórico' : 'Mostrar histórico'}</Button>
    {aberto && <div id="historico-pagamentos"><Button className="acao acao-secundaria" disabled={loading} onClick={() => { setCursor(undefined); setRevisao(r => r + 1); }}>Atualizar histórico</Button>
      {erro && <p role="alert">{erro}</p>}{loading && <p role="status">Carregando pagamentos…</p>}{!loading && !erro && !lista.length && <p>Nenhum pagamento registrado.</p>}
      <ul className="historico-lista">{lista.map(p => <li key={p.idPagamento}><button className="historico-resumo" aria-expanded={id === p.idPagamento} onClick={() => setId(id === p.idPagamento ? null : p.idPagamento)}><span>Comanda #{p.idComanda} · Mesa {p.numeroMesa}<small>{data(p.pagoEm)} · {FORMAS_PAGAMENTO[p.forma]}</small></span><strong>{moeda(p.valor)}</strong><span>{id === p.idPagamento ? 'Fechar detalhes' : 'Ver detalhes'}</span></button>
        {id === p.idPagamento && <div className="historico-detalhe">{erroDetalhe ? <p role="alert">{erroDetalhe}</p> : !detalhe || detalhe.idPagamento !== id ? <p role="status">Carregando detalhes…</p> : <>
          <h3>Pagamento #{detalhe.idPagamento}</h3><p>Cliente: {detalhe.nomeCliente} · Mesa {detalhe.numeroMesa} · Comanda #{detalhe.idComanda}</p>
          <p>Pago em {data(detalhe.pagoEm)} · {FORMAS_PAGAMENTO[detalhe.forma]}</p><p>Pré-conta #{detalhe.idPreconta} emitida em {data(detalhe.preconta.criadaEm)}</p>
          {detalhe.preconta.solicitadoEm && <p>Conta solicitada em {data(detalhe.preconta.solicitadoEm)}</p>}
          <h4>Itens consumidos</h4><ul className="caixa-itens">{detalhe.preconta.itens.map(i => <li key={i.idItem}><span>{i.quantidade}× {i.nomeProduto}<small>Pedido #{i.idPedido} · Item #{i.idItem} · {moeda(i.precoUnitario)} / un.</small></span><strong>{moeda(i.subtotal)}</strong></li>)}</ul>
          <p>Consumo: {moeda(detalhe.preconta.subtotal)}</p><h4>Taxas</h4>{!detalhe.preconta.taxas.length && <p>Sem taxas.</p>}<ul className="caixa-itens">{detalhe.preconta.taxas.map((t, n) => <li key={n}><span>{t.nome} · {t.tipo === 'PERCENTUAL' ? t.valor + '%' : 'Fixa'}</span><strong>{moeda(t.total)}</strong></li>)}</ul><div className="caixa-total"><span>Total pago</span><strong>{moeda(detalhe.valor)}</strong></div>
        </>}</div>}
      </li>)}</ul>
      {mais && <Button className="acao acao-secundaria" disabled={loading} onClick={() => setCursor(lista[lista.length - 1]?.idPagamento)}>Carregar mais pagamentos</Button>}
    </div>}
  </section>;
}
