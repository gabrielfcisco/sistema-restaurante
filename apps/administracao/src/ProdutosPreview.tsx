import { Button } from '@restaurante/ui';
import type { CategoriaDto } from '@restaurante/contracts';

export function ProdutosPreview({ categorias }: { categorias: CategoriaDto[] }) {
  return <>
    <div className="page-heading"><div><p className="eyebrow">Cardápio</p><h2>Produtos</h2><p>Cadastro e setor responsável pelo preparo.</p></div></div>
    <aside className="admin-message" role="note"><strong>Prévia da Sprint 4.</strong> Este formulário ainda não salva produtos nem altera setores.</aside>
    <section className="category-panel product-preview" aria-labelledby="novo-produto">
      <h3 id="novo-produto">Novo produto</h3>
      <div className="product-fields">
        <label>Nome<input maxLength={120} placeholder="Nome do produto" /></label>
        <label>Preço (R$)<input type="number" min="0" step="0.01" placeholder="0,00" /></label>
        <label className="product-description">Descrição<textarea maxLength={500} rows={3} placeholder="Descrição do produto" /></label>
        <label>Categoria<select defaultValue=""><option value="" disabled>Selecione uma categoria</option>{categorias.map(c => <option key={c.idCategoria} value={c.idCategoria}>{c.nome}{c.ativo ? '' : ' (inativa)'}</option>)}</select></label>
        <label>Setor responsável<select defaultValue=""><option value="" disabled>Selecione o setor</option><option value="COZINHA">Cozinha</option><option value="BAR">Bar</option></select></label>
      </div>
      <label className="product-availability"><input type="checkbox" defaultChecked /> Disponível no cardápio</label>
      <p>Produtos de categorias inativas não aparecem no cardápio. A alteração de setor será bloqueada enquanto houver itens não entregues.</p>
      <Button className="acao" disabled>Salvar produto</Button>
    </section>
    <section className="category-guidance"><div><h3>Produtos cadastrados</h3><p>A consulta e a edição de setor serão conectadas à API nas US-20 e US-26. Nenhum produto foi carregado por esta prévia.</p></div></section>
  </>;
}
