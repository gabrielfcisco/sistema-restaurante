import { Button } from '@restaurante/ui';
import { createApiClient } from '@restaurante/api-client';
import { useEffect, useRef, useState } from 'react';
import type { CategoriaDto, CriarProdutoInput, ProdutoGestaoDto, SetorOperacional } from '@restaurante/contracts';
const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3333/api');
const vazio: CriarProdutoInput = { nome: '', descricao: '', preco: 0, categoria: '', setor: 'COZINHA', ativo: true };
export function Produtos({ categorias }: { categorias: CategoriaDto[] }) {
  const [produtos, setProdutos] = useState<ProdutoGestaoDto[]>([]), [form, setForm] = useState(vazio);
  const [preco, setPreco] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [mudanca, setMudanca] = useState<{ produto: ProdutoGestaoDto; setor: SetorOperacional } | null>(null);
  const lock = useRef(false), generation = useRef(0);
  async function carregar() {
    const current = ++generation.current; setLoading(true);
    try { const r = await api.produtosGestao(); if (current === generation.current) setProdutos(r); }
    catch (e) { if (current === generation.current) setMessage(e instanceof Error ? e.message : 'Não foi possível carregar produtos.'); }
    finally { if (current === generation.current) setLoading(false); }
  }
  useEffect(() => { void carregar(); return () => { generation.current++; }; }, []);
  async function salvar() {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage('');
    try {
      if (mudanca) { await api.alterarSetor(mudanca.produto.idProduto, mudanca.setor); setMudanca(null); }
      else { await api.criarProduto({ ...form, preco: Number(preco) }); setForm(vazio); setPreco(''); }
      setMessage('Produto salvo.'); await carregar();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">Cardápio</p><h2>Produtos</h2><p>Cadastre itens e defina o setor responsável pelo preparo.</p></div><Button className="acao acao-secundaria" disabled={loading || busy} onClick={() => void carregar()}>Atualizar produtos</Button></div>
    {message && <p className="admin-message" role="status">{message}</p>}
    <form className="category-panel product-preview" onSubmit={e => { e.preventDefault(); void salvar(); }}>
      <h3>Novo produto</h3><fieldset disabled={busy || mudanca !== null}><div className="product-fields">
        <label>Nome<input required maxLength={120} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>
        <label>Preço (R$)<input required type="number" min="0" max="99999999.99" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} /></label>
        <label className="product-description">Descrição<textarea maxLength={500} rows={3} value={form.descricao ?? ''} onChange={e => setForm({ ...form, descricao: e.target.value })} /></label>
        <label>Categoria<select required value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}><option value="">Selecione uma categoria</option>{categorias.map(c => <option key={c.idCategoria} value={c.idCategoria}>{c.nome}{c.ativo ? '' : ' (inativa)'}</option>)}</select></label>
        <label>Setor responsável<select value={form.setor} onChange={e => setForm({ ...form, setor: e.target.value as SetorOperacional })}><option value="COZINHA">Cozinha</option><option value="BAR">Bar</option></select></label>
      </div><label className="product-availability"><input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} /> Disponível no cardápio</label>
      <p>Produtos inativos ou de categorias inativas ficam ocultos do cliente.</p><Button className="acao" disabled={!categorias.length}>{busy ? 'Salvando…' : 'Salvar produto'}</Button></fieldset>
    </form>
    {mudanca && <section className="category-panel category-form"><h3>Alterar setor de {mudanca.produto.nome}?</h3><label>Setor<select value={mudanca.setor} disabled={busy} onChange={e => setMudanca({ ...mudanca, setor: e.target.value as SetorOperacional })}><option value="COZINHA">Cozinha</option><option value="BAR">Bar</option></select></label><p>A alteração só será aceita sem itens pendentes em atendimentos ativos.</p><Button className="acao" disabled={busy} onClick={() => void salvar()}>Confirmar setor</Button><Button className="acao acao-secundaria" disabled={busy} onClick={() => setMudanca(null)}>Cancelar</Button></section>}
    <section className="category-panel"><h3>Produtos cadastrados</h3>{loading && <p role="status">Carregando produtos…</p>}{!loading && !produtos.length && <p>Nenhum produto cadastrado.</p>}
      <div className="category-table-wrap"><table className="category-table"><thead><tr><th>Produto</th><th>Preço</th><th>Categoria</th><th>Setor</th><th>Disponibilidade</th><th>Ações</th></tr></thead><tbody>{produtos.map(p => <tr key={p.idProduto}><td><strong>{p.nome}</strong><p>{p.descricao}</p></td><td>{p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td>{p.nomeCategoria}</td><td>{p.setor === 'BAR' ? 'Bar' : 'Cozinha'}</td><td>{p.ativo && p.categoriaAtiva ? 'Disponível' : p.ativo ? 'Categoria inativa' : 'Inativo'}</td><td><Button className="acao acao-secundaria" disabled={busy} onClick={() => setMudanca({ produto: p, setor: p.setor })}>Alterar setor</Button></td></tr>)}</tbody></table></div>
    </section>
  </>;
}
