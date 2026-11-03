import { useState } from 'react';

type Category = { id: number; name: string; active: boolean };
const initialCategories: Category[] = [
  { id: 1, name: 'PRATO', active: true },
  { id: 2, name: 'SOBREMESA', active: true },
  { id: 3, name: 'BEBIDA', active: true }
];
const navigation = [
  { label: 'Visão geral', icon: '◫', enabled: false },
  { label: 'Comandas', icon: '⌘', enabled: false },
  { label: 'Mesas', icon: '▦', enabled: false },
  { label: 'Categorias', icon: '▤', enabled: true },
  { label: 'Produtos', icon: '⬡', enabled: false },
  { label: 'Relatórios', icon: '▥', enabled: false }
];

export function App() {
  const [categories] = useState(initialCategories);
  const [message, setMessage] = useState('');
  const activeCount = categories.filter(category => category.active).length;
  const inactiveCount = categories.length - activeCount;

  function unavailable() {
    setMessage('A API da Sprint 3 ainda não está conectada. Nenhuma alteração foi salva.');
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
        <div className="page-heading"><div><p className="eyebrow">Cardápio</p><h2>Categorias</h2><p>Organize as categorias exibidas no cardápio do cliente.</p></div><button className="new-category" onClick={unavailable}><span aria-hidden="true">＋</span> Nova categoria</button></div>
        <div className="prototype-banner"><span className="prototype-dot" />Prévia visual · dados ilustrativos, sem persistência nesta etapa</div>
        {message && <p className="admin-message" role="status">{message}</p>}

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
              <tbody>{categories.map(category => <tr key={category.id}>
                <td><div className="category-name"><span className="category-icon" aria-hidden="true">▤</span><div><strong>{category.name}</strong><small>Categoria inicial</small></div></div></td>
                <td><span className={'status-pill ' + (category.active ? 'status-active' : 'status-inactive')}><span />{category.active ? 'Ativa' : 'Inativa'}</span></td>
                <td className="visibility-cell">{category.active ? 'Visível no cardápio' : 'Oculta do cardápio'}</td>
                <td><div className="row-actions"><button onClick={unavailable}>Editar</button><button onClick={unavailable}>{category.active ? 'Inativar' : 'Ativar'}</button></div></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="panel-footer"><span>Exibindo {categories.length} categorias</span><span>Alterações serão persistidas quando a API US-19 for integrada.</span></div>
        </section>

        <section className="category-guidance"><div className="guidance-icon" aria-hidden="true">i</div><div><h3>Sobre as categorias</h3><p>Inativar uma categoria oculta seus produtos no cardápio. Os produtos e pedidos já registrados são preservados.</p></div></section>
      </main>
    </div>
  </div>;
}
