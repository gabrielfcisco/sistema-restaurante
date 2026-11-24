import { useEffect, useRef, useState } from 'react';
import { createApiClient } from '@restaurante/api-client';
import type { CategoriaDto } from '@restaurante/contracts';

const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3333/api');
const navigation = [
  { label: 'Visão geral', icon: '◫', enabled: false },
  { label: 'Comandas', icon: '⌘', enabled: false },
  { label: 'Mesas', icon: '▦', enabled: false },
  { label: 'Categorias', icon: '▤', enabled: true },
  { label: 'Produtos', icon: '⬡', enabled: false },
  { label: 'Relatórios', icon: '▥', enabled: false }
];

export function App() {
  const [categories, setCategories] = useState<CategoriaDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ id?: string; nome: string; ativo: boolean } | null>(null);
  const [confirmar, setConfirmar] = useState<CategoriaDto | null>(null);
  const lock = useRef(false), version = useRef(0);
  const [message, setMessage] = useState('');
  const activeCount = categories.filter(category => category.ativo).length;
  const inactiveCount = categories.length - activeCount;

  function unavailable() {
    setMessage('Esta funcionalidade não faz parte da gestão de categorias.');
  }
  async function carregar() {
    const current = ++version.current;
    setLoading(true);
    try { const data = await api.categorias(); if (current === version.current) setCategories(data); }
    catch (e) { if (current === version.current) setMessage(e instanceof Error ? e.message : 'Não foi possível carregar categorias.'); }
    finally { if (current === version.current) setLoading(false); }
  }
  useEffect(() => { void carregar(); return () => { version.current++; }; }, []);
  async function salvar() {
    if (lock.current || (!form && !confirmar)) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      if (confirmar) await api.alterarCategoria(confirmar.idCategoria, { ativo: !confirmar.ativo });
      else if (form?.id) await api.alterarCategoria(form.id, { nome: form.nome, ativo: form.ativo });
      else if (form) await api.criarCategoria(form.nome);
      setForm(null); setConfirmar(null); setMessage('Categoria salva.');
      await carregar();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { lock.current = false; setBusy(false); }
  }

  return <div className="admin-app">
    <header className="admin-topbar">
      <div className="admin-brand"><span className="admin-mark" aria-hidden="true">M</span><h1>Administração</h1></div>
      <span className="story-badge">US-19 · Categorias</span>
    </header>

    <div className="admin-layout">
      <aside className="admin-sidebar" aria-label="Navegação da administração">
        <div className="sidebar-brand">mesa<span>.</span></div>
        <nav>{navigation.map(item => item.enabled ? <a href="#categorias" className="nav-item active" key={item.label} aria-current="page"><span aria-hidden="true">{item.icon}</span>{item.label}</a>
          : <button className="nav-item disabled" key={item.label} title="Fora do escopo visual desta entrega" onClick={unavailable}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
        <p className="sidebar-footnote">Painel administrativo</p>
      </aside>

      <main className="admin-main" id="categorias">
        <div className="page-heading"><div><p className="eyebrow">Cardápio</p><h2>Categorias</h2><p>Organize as categorias exibidas no cardápio do cliente.</p></div><button className="acao new-category" disabled={busy} onClick={() => { setConfirmar(null); setForm({ nome: '', ativo: true }); setMessage(''); }}><span aria-hidden="true">＋</span> Nova categoria</button></div>
        <button className="acao acao-secundaria" disabled={loading || busy} onClick={() => void carregar()}>Atualizar categorias</button>
        {loading && <p role="status">Carregando categorias…</p>}
        {message && <p className="admin-message" role="status">{message}</p>}
        {form && <form className="category-panel category-form" onSubmit={e => { e.preventDefault(); void salvar(); }}><h3>{form.id ? 'Editar categoria' : 'Nova categoria'}</h3><label htmlFor="nome-categoria">Nome</label><input id="nome-categoria" autoFocus required maxLength={120} value={form.nome} disabled={busy} onChange={e => setForm({ ...form, nome: e.target.value })} />{form.id && <label><input type="checkbox" checked={form.ativo} disabled={busy} onChange={e => setForm({ ...form, ativo: e.target.checked })} /> Categoria ativa</label>}<p>Ao inativar, os produtos associados ficam ocultos no cardápio.</p><button className="acao new-category" disabled={busy}>{busy ? 'Salvando…' : 'Salvar categoria'}</button><button className="acao acao-secundaria" type="button" disabled={busy} onClick={() => setForm(null)}>Cancelar</button></form>}
        {confirmar && <section className="category-panel category-form" aria-label="Confirmar alteração"><h3>{confirmar.ativo ? 'Inativar' : 'Ativar'} {confirmar.nome}?</h3><p>{confirmar.ativo ? 'Os produtos desta categoria ficarão ocultos. Pedidos já confirmados serão preservados.' : 'A categoria voltará a aparecer no cardápio.'}</p><button className="acao new-category" disabled={busy} onClick={() => void salvar()}>Confirmar</button><button className="acao acao-secundaria" disabled={busy} onClick={() => setConfirmar(null)}>Cancelar</button></section>}

        <section className="summary-grid" aria-label="Resumo das categorias">
          <article className="summary-card"><span>Total de categorias</span><strong>{categories.length}</strong><small>Inclui categorias ativas e inativas</small></article>
          <article className="summary-card"><span>Categorias ativas</span><strong>{activeCount}</strong><small>Disponíveis no cardápio</small></article>
          <article className="summary-card"><span>Categorias inativas</span><strong>{inactiveCount}</strong><small>Produtos associados ficam ocultos</small></article>
        </section>

        <section className="category-panel" aria-labelledby="category-list-title">
          <div className="panel-heading"><div><h3 id="category-list-title">Categorias cadastradas</h3><p>As categorias inativas e seus produtos não aparecem para o cliente.</p></div><span className="panel-count">{categories.length} {categories.length === 1 ? 'categoria' : 'categorias'}</span></div>
          <div className="category-table-wrap">
            <table className="category-table">
              <thead><tr><th scope="col">Categoria</th><th scope="col">Status</th><th scope="col">Visibilidade</th><th scope="col" className="actions-heading">Ações</th></tr></thead>
              <tbody>{categories.map(category => <tr key={category.idCategoria}>
                <td><div className="category-name"><span className="category-icon" aria-hidden="true">▤</span><div><strong>{category.nome}</strong></div></div></td>
                <td><span className={'status-pill ' + (category.ativo ? 'status-active' : 'status-inactive')}><span />{category.ativo ? 'Ativa' : 'Inativa'}</span></td>
                <td className="visibility-cell">{category.ativo ? 'Visível no cardápio' : 'Oculta do cardápio'}</td>
                <td><div className="row-actions"><button className="acao acao-secundaria" disabled={busy} onClick={() => { setConfirmar(null); setForm({ id: category.idCategoria, nome: category.nome, ativo: category.ativo }); }}>Editar</button><button className="acao acao-secundaria" disabled={busy} onClick={() => { setForm(null); setConfirmar(category); }}>{category.ativo ? 'Inativar' : 'Ativar'}</button></div></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="panel-footer"><span>Exibindo {categories.length} categorias</span><span>Alterações confirmadas são salvas no cardápio.</span></div>
        </section>

        <section className="category-guidance"><div className="guidance-icon" aria-hidden="true">i</div><div><h3>Sobre as categorias</h3><p>Inativar uma categoria oculta seus produtos no cardápio. Os produtos e pedidos já registrados são preservados.</p></div></section>
      </main>
    </div>
  </div>;
}
