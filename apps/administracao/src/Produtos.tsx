import { Button } from '@restaurante/ui';
import { createApiClient } from '@restaurante/api-client';
import { useEffect, useRef, useState } from 'react';
import type { CategoriaDto, CriarProdutoInput, ProdutoGestaoDto, SetorOperacional } from '@restaurante/contracts';
const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3333/api');
const vazio: CriarProdutoInput = { nome: '', descricao: '', preco: 0, categoria: '', setor: 'COZINHA', ativo: true, imagemPath: null };
export function Produtos({ categorias }: { categorias: CategoriaDto[] }) {
  const [produtos, setProdutos] = useState<ProdutoGestaoDto[]>([]), [form, setForm] = useState(vazio);
  const [preco, setPreco] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [id, setId] = useState<number | null>(null), [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [foto, setFoto] = useState<File | null>(null), [preview, setPreview] = useState(''), [fileKey, setFileKey] = useState(0);
  const lock = useRef(false), generation = useRef(0), editor = useRef<HTMLFormElement>(null);
  useEffect(() => { if (!foto) { setPreview(''); return; } const url = URL.createObjectURL(foto); setPreview(url); return () => URL.revokeObjectURL(url); }, [foto]);
  async function carregar() {
    const current = ++generation.current; setLoading(true);
    try { const r = await api.produtosGestao(); if (current === generation.current) setProdutos(r); }
    catch (e) { if (current === generation.current) setMessage(e instanceof Error ? e.message : 'Não foi possível carregar produtos.'); }
    finally { if (current === generation.current) setLoading(false); }
  }
  useEffect(() => { void carregar(); return () => { generation.current++; }; }, []);
  function limpar() { setId(null); setForm(vazio); setPreco(''); setFoto(null); setFileKey(k => k + 1); setConfirmarExclusao(false); }
  function editar(p: ProdutoGestaoDto) {
    setId(p.idProduto); setForm({ nome: p.nome, descricao: p.descricao, preco: p.preco, categoria: p.categoria, setor: p.setor, ativo: p.ativo, imagemPath: p.imagemPath });
    setPreco(String(p.preco)); setFoto(null); setFileKey(k => k + 1); setConfirmarExclusao(false); setMessage('');
    editor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); editor.current?.querySelector('input')?.focus();
  }
  async function salvar() {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage('');
    try {
      let imagemPath = form.imagemPath;
      if (foto) { imagemPath = (await api.enviarFoto(foto)).imagemPath; setForm(f => ({ ...f, imagemPath })); setFoto(null); setFileKey(k => k + 1); }
      const dados = { ...form, preco: Number(preco), imagemPath };
      if (id !== null) await api.alterarProduto(id, dados); else await api.criarProduto(dados);
      limpar(); setMessage('Produto salvo.'); await carregar();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function excluir() {
    if (lock.current || id === null) return; lock.current = true; setBusy(true); setMessage('');
    try { await api.excluirProduto(id); limpar(); setMessage('Produto excluído. Os pedidos anteriores foram preservados.'); await carregar(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível excluir.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const imagem = preview || (form.imagemPath ? api.imagemUrl(form.imagemPath) : '');
  return <>
    <div className="page-heading"><div><p className="eyebrow">Cardápio</p><h2>Produtos</h2><p>Cadastre e edite os itens do cardápio.</p></div><Button className="acao acao-secundaria" disabled={loading || busy} onClick={() => void carregar()}>Atualizar produtos</Button></div>
    {message && <p className="admin-message" role="status">{message}</p>}
    <form ref={editor} className="category-panel product-preview" onSubmit={e => { e.preventDefault(); void salvar(); }}>
      <h3>{id === null ? 'Novo produto' : 'Editar produto'}</h3><fieldset disabled={busy}><div className="product-fields">
        <label>Nome<input required maxLength={120} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>
        <label>Preço (R$)<input required type="number" min="0" max="99999999.99" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} /></label>
        <label className="product-description">Descrição<textarea maxLength={500} rows={3} value={form.descricao ?? ''} onChange={e => setForm({ ...form, descricao: e.target.value })} /></label>
        <label>Categoria<select required value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}><option value="">Selecione uma categoria</option>{categorias.map(c => <option key={c.idCategoria} value={c.idCategoria}>{c.nome}{c.ativo ? '' : ' (inativa)'}</option>)}</select></label>
        <label>Setor responsável<select value={form.setor} onChange={e => setForm({ ...form, setor: e.target.value as SetorOperacional })}><option value="COZINHA">Cozinha</option><option value="BAR">Bar</option></select></label>
        <label>Foto do produto<input key={fileKey} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024) { setMessage('Selecione uma foto PNG, JPEG ou WebP de até 5 MB.'); e.target.value = ''; return; } setFoto(f); setMessage(''); }} /><small>PNG, JPEG ou WebP, até 5 MB.</small></label>
        {imagem && <div><img className="product-photo-preview" src={imagem} alt="Foto do produto" /><Button type="button" className="acao acao-secundaria" onClick={() => { setFoto(null); setForm({ ...form, imagemPath: null }); setFileKey(k => k + 1); }}>Remover foto</Button></div>}
      </div><label className="product-availability"><input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} /> Disponível no cardápio</label>
      <p>Produtos inativos ou de categorias inativas ficam ocultos do cliente.</p>
      {id !== null && <p>A troca de setor exige que os itens pendentes sejam entregues. Pedidos já confirmados mantêm o nome e o preço registrados.</p>}
      <div className="row-actions"><Button className="acao" disabled={!categorias.length || confirmarExclusao}>{busy ? 'Salvando…' : 'Salvar produto'}</Button>
      {id !== null && <><Button type="button" className="acao acao-secundaria" onClick={limpar}>Cancelar edição</Button><Button type="button" className="acao acao-perigo" onClick={() => setConfirmarExclusao(true)}>Excluir produto</Button></>}</div>
      {confirmarExclusao && <section className="delete-confirmation" aria-label="Confirmar exclusão do produto"><h4>Excluir {form.nome}?</h4><p>O produto sairá do cadastro e do cardápio. Pedidos e pagamentos anteriores serão preservados.</p><Button type="button" className="acao acao-perigo" onClick={() => void excluir()}>Confirmar exclusão</Button><Button type="button" className="acao acao-secundaria" onClick={() => setConfirmarExclusao(false)}>Manter produto</Button></section>}
      </fieldset>
    </form>
    <section className="category-panel"><h3>Produtos cadastrados</h3>{loading && <p role="status">Carregando produtos…</p>}{!loading && !produtos.length && <p>Nenhum produto cadastrado.</p>}
      <div className="category-table-wrap"><table className="category-table"><thead><tr><th>Produto</th><th>Preço</th><th>Categoria</th><th>Setor</th><th>Disponibilidade</th><th>Ações</th></tr></thead><tbody>{produtos.map(p => <tr key={p.idProduto}><td>{p.imagemPath && <img className="product-photo-thumb" src={api.imagemUrl(p.imagemPath)} alt="" />}<strong>{p.nome}</strong><p>{p.descricao}</p></td><td>{p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td>{p.nomeCategoria}</td><td>{p.setor === 'BAR' ? 'Bar' : 'Cozinha'}</td><td>{p.ativo && p.categoriaAtiva ? 'Disponível' : p.ativo ? 'Categoria inativa' : 'Inativo'}</td><td><Button className="acao acao-secundaria" disabled={busy} onClick={() => editar(p)}>Editar</Button></td></tr>)}</tbody></table></div>
    </section>
  </>;
}
