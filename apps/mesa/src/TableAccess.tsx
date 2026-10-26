import { useEffect, useRef, useState } from 'react';
import { ApiError, createApiClient } from '@restaurante/api-client';
import type { CategoriaCardapio, ItemCarrinhoDto, PedidoConfirmadoDto, ProdutoResumoDto, SessaoMesaDto } from '@restaurante/contracts';
import { AppShell, Button } from '@restaurante/ui';
import { browserCamera } from './platform/camera';
const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3333/api');
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatarMoeda = (valor: number) => moeda.format(valor);
const rotuloSetor = (setor: 'COZINHA' | 'BAR') => setor === 'COZINHA' ? 'Cozinha' : 'Bar';
const rotuloStatus = (status: string) => status === 'EM_PREPARO' ? 'Em preparo' : status === 'PRONTO' ? 'Pronto' : status === 'ENTREGUE' ? 'Entregue' : 'Recebido';
export function TableAccess() {
  const [codigo, setCodigo] = useState(''), [session, setSession] = useState<SessaoMesaDto | null>(null);
  const [error, setError] = useState(''), [status, setStatus] = useState('Use seu cartão para identificar o atendimento.');
  const [busy, setBusy] = useState(false), [scanning, setScanning] = useState(false), [offline, setOffline] = useState(false);
  const [admin, setAdmin] = useState(false), [numero, setNumero] = useState('');
  const [mesaAtual, setMesaAtual] = useState<number | null>(null);
  const [produtos, setProdutos] = useState<ProdutoResumoDto[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<'TODOS' | 'COMIDAS' | 'BEBIDAS'>('TODOS');
  const [carrinho, setCarrinho] = useState<ItemCarrinhoDto[]>([]);
  const [telaMesa, setTelaMesa] = useState<'cardapio' | 'carrinho' | 'confirmar' | 'enviado'>('cardapio');
  const [avisoCarrinho, setAvisoCarrinho] = useState('');
  const [ultimoPedido, setUltimoPedido] = useState<PedidoConfirmadoDto | null>(null);
  const [historicoPedidos, setHistoricoPedidos] = useState<PedidoConfirmadoDto[]>([]);
  const chavePedido = useRef(crypto.randomUUID());
  const video = useRef<HTMLVideoElement>(null), stopCamera = useRef<(() => void) | null>(null);
  const generation = useRef(0), locked = useRef(false);
  function limparEstadoCliente() {
    setProdutos([]); setCategoriaFiltro('TODOS'); setCarrinho([]);
    setTelaMesa('cardapio'); setAvisoCarrinho(''); setUltimoPedido(null); setHistoricoPedidos([]);
    chavePedido.current = crypto.randomUUID();
  }
  function stop() { generation.current++; stopCamera.current?.(); stopCamera.current = null; setScanning(false); }
  useEffect(() => () => { generation.current++; stopCamera.current?.(); }, []);
  async function acessar(value: string) {
    if (locked.current) return;
    locked.current = true; stop(); setBusy(true); setError('');
    try {
      if (value.trim() === 'adm1234') {
        const mesa = await api.mesaDispositivo();
        setMesaAtual(mesa.numero); setNumero(String(mesa.numero)); setAdmin(true); setCodigo('');
        setStatus('Confira e altere o número da mesa deste dispositivo.');
        return;
      }
      const s = await api.acessar(value.trim());
      limparEstadoCliente();
      setSession(s); setCodigo(''); setOffline(false); setStatus('Atendimento identificado.');
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível identificar seu cartão.'); }
    finally { locked.current = false; setBusy(false); }
  }
  async function salvarMesa() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const mesa = await api.configurarDispositivo(Number(numero), 'adm1234');
      setMesaAtual(mesa.numero); setAdmin(false); setCodigo('');
      setStatus('Dispositivo configurado para a mesa ' + mesa.numero + '. Identifique o cartão do próximo cliente.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível alterar a mesa.'); }
    finally { locked.current = false; setBusy(false); }
  }
  async function iniciarCamera() {
    if (scanning || busy) return;
    setError(''); setScanning(true);
    const current = ++generation.current;
    try {
      if (!video.current) return;
      const cancel = await browserCamera.start(video.current, code => { if (current === generation.current) void acessar(code); });
      if (current !== generation.current) cancel(); else stopCamera.current = cancel;
    } catch (e) { if (current === generation.current) { setScanning(false); setError(e instanceof Error ? e.message : 'Câmera indisponível.'); } }
  }
  useEffect(() => {
    if (!session) return;
    let active = true;
    const expire = setTimeout(() => { limparEstadoCliente(); setSession(null); setCodigo(''); setError('Sua sessão expirou. Identifique o cartão novamente.'); }, Math.max(0, new Date(session.expiraEm).getTime() - Date.now()));
    const loadCatalog = async () => {
      try {
        const lista = await api.produtosCardapio(session.token);
        if (active) setProdutos(lista);
      } catch { /* Catálogo pode ser recarregado na próxima verificação */ }
    };
    const check = async () => {
      try {
        await api.sessao(session.token);
        if (active) { setOffline(false); }
      }
      catch (e) {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) { limparEstadoCliente(); setSession(null); setCodigo(''); setError(e.message); }
        else { setOffline(true); setError('Servidor indisponível. Atendimento temporariamente bloqueado até reconectar.'); }
      }
    };
    const timer = setInterval(() => void check(), 15000);
    void check();
    void loadCatalog();
    return () => { active = false; clearInterval(timer); clearTimeout(expire); };
  }, [session]);
  async function sair() {
    if (!session) return;
    const token = session.token;
    stop(); limparEstadoCliente(); setSession(null); setCodigo(''); setError(''); setOffline(false); setStatus('Sessão removida deste dispositivo. Próximo cliente, identifique seu cartão.');
    try { await api.sair(token); }
    catch { setError('Dados removidos deste dispositivo. Sem conexão para revogar no servidor; a sessão expira automaticamente.'); }
  }
  function adicionarAoCarrinho(produto: ProdutoResumoDto, qtd = 1) {
    if (!produto.disponivel || qtd < 1) return;
    setError('');
    setCarrinho(atual => {
      const existente = atual.find(i => i.idProduto === produto.idProduto);
      if (existente) {
        return atual.map(i => i.idProduto === produto.idProduto ? { ...i, quantidade: i.quantidade + qtd, precoUnitario: produto.preco, nome: produto.nome, setor: produto.setor } : i);
      }
      return [...atual, { idProduto: produto.idProduto, nome: produto.nome, precoUnitario: produto.preco, quantidade: qtd, setor: produto.setor }];
    });
    chavePedido.current = crypto.randomUUID();
    setAvisoCarrinho(`${produto.nome} adicionado ao carrinho`);
  }
  function alterarQuantidadeCarrinho(idProduto: number, novaQuantidade: number) {
    setError('');
    setCarrinho(atual => {
      if (novaQuantidade <= 0) return atual.filter(i => i.idProduto !== idProduto);
      return atual.map(i => i.idProduto === idProduto ? { ...i, quantidade: novaQuantidade } : i);
    });
    chavePedido.current = crypto.randomUUID();
  }
  function abrirRevisaoPedido() {
    setError('');
    setAvisoCarrinho('');
    setTelaMesa('carrinho');
  }
  function iniciarConfirmacaoEnvio() {
    if (carrinho.length === 0) {
      setError('Adicione ao menos um item antes de confirmar o pedido.');
      return;
    }
    setError('');
    setTelaMesa('confirmar');
  }
  async function confirmarEnvioPedido() {
    if (!session || locked.current) return;
    if (carrinho.length === 0) {
      setError('Adicione ao menos um item antes de confirmar o pedido.');
      return;
    }
    locked.current = true; setBusy(true); setError('');
    try {
      const pedido = await api.confirmarPedido(session.idComanda, {
        itens: carrinho.map(i => ({ idProduto: i.idProduto, quantidade: i.quantidade, observacao: i.observacao ?? null }))
      }, session.token, chavePedido.current);
      setUltimoPedido(pedido);
      setHistoricoPedidos(atual => [pedido, ...atual.filter(p => p.idPedido !== pedido.idPedido)]);
      setCarrinho([]);
      setAvisoCarrinho('');
      chavePedido.current = crypto.randomUUID();
      setTelaMesa('enviado');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar o pedido.');
      if (e instanceof ApiError && e.code === 'PRODUTO_INDISPONIVEL') {
        try { setProdutos(await api.produtosCardapio(session.token)); } catch { /* Mantém lista atual */ }
      }
    } finally {
      locked.current = false; setBusy(false);
    }
  }
  const totalItensCarrinho = carrinho.reduce((soma, item) => soma + item.quantidade, 0);
  const valorTotalCarrinho = Math.round(carrinho.reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0) * 100) / 100;
  const itensCozinhaResumo = carrinho.filter(i => i.setor === 'COZINHA').map(i => `${i.quantidade}× ${i.nome}`).join(', ');
  const itensBarResumo = carrinho.filter(i => i.setor === 'BAR').map(i => `${i.quantidade}× ${i.nome}`).join(', ');
  const produtosVisiveis = produtos.filter(p => {
    if (!p.disponivel) return false;
    if (categoriaFiltro === 'COMIDAS') return (['PRATO', 'SOBREMESA'] as CategoriaCardapio[]).includes(p.categoria);
    if (categoriaFiltro === 'BEBIDAS') return p.categoria === 'BEBIDA';
    return true;
  });
  return <AppShell title="Mesa">
    {admin ? <section className="panel welcome"><p className="eyebrow">Configuração do dispositivo</p><h1>Alterar mesa</h1><p>Mesa atual: <strong>{mesaAtual}</strong>. Este número define quais comandas podem acessar este dispositivo.</p>
      {error && <p role="alert" className="notice error">{error}</p>}
      <form onSubmit={e => { e.preventDefault(); void salvarMesa(); }}><label htmlFor="numero-mesa">Número da mesa</label><input id="numero-mesa" type="number" min={1} max={4294967295} step={1} value={numero} onChange={e => setNumero(e.target.value)} disabled={busy} autoFocus required /><div className="table-actions"><Button disabled={busy || !/^[1-9]\d*$/.test(numero) || Number(numero) > 4294967295}>{busy ? 'Salvando…' : 'Salvar mesa'}</Button><Button type="button" className="secondary" disabled={busy} onClick={() => { setAdmin(false); setError(''); setStatus('Use seu cartão para identificar o atendimento.'); }}>Cancelar</Button></div></form>
    </section> : session ? <section className="panel welcome">
      <div className="mesa-topbar">
        <div>
          <p className="eyebrow">Atendimento identificado</p>
          <h1>Olá, {session.nomeCliente}.</h1>
          <p className="session-number">Mesa {String(session.numeroMesa).padStart(2, '0')} · Comanda #{session.idComanda} · Cartão {session.codigoCartao}</p>
        </div>
        <div className="mesa-topbar-actions">
          <Button type="button" onClick={abrirRevisaoPedido} disabled={busy || offline}>
            Carrinho <span className="cart-badge" data-testid="cart-count">{totalItensCarrinho}</span>
          </Button>
          <Button type="button" className="secondary" onClick={() => void sair()}>Sair / trocar cliente</Button>
        </div>
      </div>
      <p role="status">{offline ? 'Aguardando conexão com o servidor.' : 'Seu cartão foi validado para esta mesa.'}</p>
      {error && <p role="alert" className="notice error">{error}</p>}
      {avisoCarrinho && telaMesa === 'cardapio' && <div className="notice success" role="status">
        <strong>{avisoCarrinho}</strong>{' '}
        <button type="button" className="remove-link" onClick={abrirRevisaoPedido}>Ver carrinho →</button>
      </div>}
      {!offline && telaMesa === 'cardapio' && <div className="menu-gateway">
        <div className="heading-row">
          <div>
            <h2>O que você deseja?</h2>
            <p className="muted">Mesa {String(session.numeroMesa).padStart(2, '0')} · Cartão {session.codigoCartao}</p>
          </div>
          {ultimoPedido && <Button type="button" className="secondary" onClick={() => setTelaMesa('enviado')}>Ver último pedido (#{ultimoPedido.idPedido})</Button>}
        </div>
        <div className="category-tabs" role="tablist" aria-label="Categorias do cardápio">
          <button type="button" className={'category-tab' + (categoriaFiltro === 'TODOS' ? ' active' : '')} onClick={() => setCategoriaFiltro('TODOS')}>Todos</button>
          <button type="button" className={'category-tab' + (categoriaFiltro === 'COMIDAS' ? ' active' : '')} onClick={() => setCategoriaFiltro('COMIDAS')}>Comidas</button>
          <button type="button" className={'category-tab' + (categoriaFiltro === 'BEBIDAS' ? ' active' : '')} onClick={() => setCategoriaFiltro('BEBIDAS')}>Bebidas</button>
        </div>
        {produtosVisiveis.length === 0 ? <p className="muted">Nenhum item disponível nesta categoria no momento.</p> : <div className="catalog-grid">
          {produtosVisiveis.map(produto => <article key={produto.idProduto} className="product-card" data-product-id={produto.idProduto}>
            <div>
              <h3>{produto.nome}</h3>
              {produto.descricao && <p className="muted">{produto.descricao}</p>}
              <p className="product-price">{formatarMoeda(produto.preco)}</p>
              <p className="product-sector">Vai para {produto.setor === 'COZINHA' ? 'a cozinha' : 'o bar'}</p>
            </div>
            <Button type="button" disabled={busy} onClick={() => adicionarAoCarrinho(produto, 1)}>Adicionar ao carrinho</Button>
          </article>)}
        </div>}
      </div>}
      {!offline && telaMesa === 'carrinho' && <div className="menu-gateway" data-testid="revisao-pedido">
        <h2>Seu carrinho</h2>
        {carrinho.length === 0 ? <div>
          <p className="muted">Seu carrinho está vazio. Adicione itens do cardápio antes de confirmar o pedido.</p>
          <div className="table-actions">
            <Button type="button" disabled>Pedir</Button>
            <Button type="button" className="secondary" onClick={() => setTelaMesa('cardapio')}>Continuar escolhendo</Button>
          </div>
        </div> : <div className="cart-layout">
          <div className="cart-list">
            {carrinho.map(item => {
              const subtotalItem = Math.round(item.precoUnitario * item.quantidade * 100) / 100;
              return <article key={item.idProduto} className="cart-item-card" data-cart-product-id={item.idProduto}>
                <div className="cart-item-header">
                  <div>
                    <h3>{item.quantidade}× {item.nome}</h3>
                    <p className="cart-item-meta">{formatarMoeda(item.precoUnitario)} cada · {rotuloSetor(item.setor)}</p>
                  </div>
                  <button type="button" className="remove-link" onClick={() => alterarQuantidadeCarrinho(item.idProduto, 0)}>Remover</button>
                </div>
                <div className="cart-item-controls">
                  <div className="qty-stepper">
                    <button type="button" className="qty-btn" aria-label={'Diminuir quantidade de ' + item.nome} onClick={() => alterarQuantidadeCarrinho(item.idProduto, item.quantidade - 1)}>-</button>
                    <span className="qty-value" data-testid={'qty-' + item.idProduto}>{item.quantidade}</span>
                    <button type="button" className="qty-btn" aria-label={'Aumentar quantidade de ' + item.nome} onClick={() => alterarQuantidadeCarrinho(item.idProduto, item.quantidade + 1)}>+</button>
                  </div>
                  <p className="cart-item-subtotal" data-testid={'subtotal-' + item.idProduto}>{formatarMoeda(subtotalItem)}</p>
                </div>
              </article>;
            })}
          </div>
          <aside className="cart-summary-card">
            <h3>Resumo</h3>
            <p className="muted">{totalItensCarrinho} {totalItensCarrinho === 1 ? 'item' : 'itens'}</p>
            <hr />
            <p className="muted" style={{ margin: 0 }}>Total</p>
            <p className="cart-total-value" data-testid="cart-total">{formatarMoeda(valorTotalCarrinho)}</p>
            <Button type="button" disabled={busy || carrinho.length === 0} onClick={iniciarConfirmacaoEnvio}>Pedir</Button>
            <Button type="button" className="secondary" disabled={busy} onClick={() => setTelaMesa('cardapio')}>Continuar escolhendo</Button>
          </aside>
        </div>}
      </div>}
      {!offline && telaMesa === 'confirmar' && <div className="confirm-modal-card" data-testid="confirmacao-pedido">
        <span className="confirm-badge">Confirmação</span>
        <h2>Enviar este pedido?</h2>
        <p>
          {totalItensCarrinho} {totalItensCarrinho === 1 ? 'item' : 'itens'}
          {itensCozinhaResumo ? ` · Cozinha: ${itensCozinhaResumo}` : ''}
          {itensBarResumo ? ` · Bar: ${itensBarResumo}` : ''}
          {` · Total ${formatarMoeda(valorTotalCarrinho)}`}
        </p>
        <div className="table-actions">
          <Button type="button" className="secondary" disabled={busy} onClick={() => setTelaMesa('carrinho')}>Voltar</Button>
          <Button type="button" disabled={busy || carrinho.length === 0} onClick={() => void confirmarEnvioPedido()}>{busy ? 'Enviando…' : 'Confirmar envio'}</Button>
        </div>
      </div>}
      {!offline && telaMesa === 'enviado' && ultimoPedido && <div className="menu-gateway" data-testid="pedido-enviado">
        <span className="confirm-badge success">Pedido enviado</span>
        <h2>Pedido {ultimoPedido.idPedido}</h2>
        <p className="muted">Mesa {String(ultimoPedido.numeroMesa).padStart(2, '0')} · Cartão {session.codigoCartao} · carrinho vazio</p>
        <div className="cart-layout">
          <div className="cart-list">
            {ultimoPedido.itens.map(item => <article key={item.idItem} className="cart-item-card">
              <h3>{item.quantidade}× {item.nomeProduto}</h3>
              <p className="cart-item-meta">{rotuloSetor(item.setor)} · {formatarMoeda(item.subtotal)}</p>
              <span className="order-item-badge">{rotuloStatus(item.status)}</span>
            </article>)}
          </div>
          <aside className="cart-summary-card">
            <h3>Histórico do pedido</h3>
            <p className="muted">
              {new Date(ultimoPedido.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · Pedido recebido ({formatarMoeda(ultimoPedido.total)})
            </p>
            {historicoPedidos.length > 1 && <p className="muted">{historicoPedidos.length} pedidos enviados nesta sessão.</p>}
            <Button type="button" className="secondary" onClick={() => setTelaMesa('cardapio')}>Voltar ao cardápio</Button>
          </aside>
        </div>
      </div>}
      <p className="muted">Sair remove seu acesso do dispositivo e mantém a comanda aberta.</p>
    </section> : <div className="access-layout"><div><p className="eyebrow">Boas-vindas à mesa</p><h1>Seu cartão.<br />Seu atendimento.</h1><p>Escaneie o QR Code do cartão entregue pela recepção ou informe o código impresso.</p><div className="steps"><p><strong>1.</strong> Receba seu cartão na recepção.</p><p><strong>2.</strong> Identifique-o neste dispositivo.</p><p><strong>3.</strong> Confira sua comanda e sua mesa.</p></div></div>
      <section className="panel"><h2>Identificar comanda</h2><p role="status">{status}</p>{error && <p role="alert" className="notice error">{error}</p>}
        <video ref={video} muted playsInline className={'camera-preview' + (!scanning ? ' hidden' : '')} aria-label="Prévia da câmera para leitura do QR Code" />
        <Button className="wide secondary" disabled={busy} onClick={() => scanning ? stop() : void iniciarCamera()}>{scanning ? 'Parar câmera' : 'Escanear QR Code'}</Button>
        <div className="divider">ou digite o código</div>
        <form onSubmit={e => { e.preventDefault(); void acessar(codigo); }}><label htmlFor="codigo">Código do cartão</label><input id="codigo" autoComplete="off" inputMode="numeric" value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} maxLength={5} disabled={busy} placeholder="Código de 5 dígitos" required /><Button className="wide" disabled={busy || !/^[0-9]{5}$/.test(codigo)}>{busy ? 'Validando…' : 'Acessar atendimento'}</Button></form>
        <p className="muted">O cartão deve estar vinculado à mesa deste dispositivo. Se precisar de ajuda, procure a recepção.</p>
      </section></div>}
  </AppShell>;
}

