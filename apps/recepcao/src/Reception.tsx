import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ApiError, createApiClient } from '@restaurante/api-client';
import { cpfValido, mascararCpf, normalizarCpf, type AtendimentoDto, type ClienteDto, type MesaDto, type MesaDetalheDto } from '@restaurante/contracts';
import { AppShell, Button } from '@restaurante/ui';
const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3333/api');
const labels = { LIVRE: 'Livre', OCUPADA: 'Ocupada', RESERVADA: 'Reservada', MANUTENCAO: 'Manutenção' };
const message = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
export function Reception() {
  const [cpf, setCpf] = useState(''), [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cliente, setCliente] = useState<ClienteDto | null>(null);
  const [novo, setNovo] = useState(false);
  const [mesas, setMesas] = useState<MesaDto[]>([]);
  const [mesaId, setMesaId] = useState(0), [codigoCartao, setCodigoCartao] = useState('');
  const [detalhe, setDetalhe] = useState<MesaDetalheDto | null>(null), [confirmarLiberacao, setConfirmarLiberacao] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('Carregando mesas…');
  const [atendimento, setAtendimento] = useState<AtendimentoDto | null>(null);
  const [qr, setQr] = useState('');
  const chave = useRef(crypto.randomUUID());
  const lock = useRef(false);
  const mesa = mesas.find(m => m.idMesa === mesaId);
  async function refresh() {
    setMesas(await api.mesas());
    setStatus('Mapa de mesas atualizado.');
  }
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const m = await api.mesas();
        if (alive) { setMesas(m); setStatus('Mapa de mesas atualizado.'); }
      } catch (e) { if (alive) setError(message(e)); }
    };
    void load();
    const timer = setInterval(() => { if (!lock.current) void load(); }, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  async function act(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await operation(); }
    catch (e) { setError(message(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  function alterarCpf(value: string) { setCpf(value); setCliente(null); setNovo(false); setNome(''); setTelefone(''); setAtendimento(null); setQr(''); chave.current = crypto.randomUUID(); }
  async function buscar() {
    if (!cpfValido(cpf)) { setError('Informe um CPF válido.'); return; }
    await act(async () => {
      try { const c = await api.buscarCliente(cpf); setCliente(c); setNome(c.nome); setTelefone(c.telefone ?? ''); setNovo(false); setStatus('Cliente encontrado. Escolha a mesa e informe o cartão.'); }
      catch (e) { if (e instanceof ApiError && e.code === 'CLIENTE_INEXISTENTE') { setNovo(true); setStatus('Novo cliente. Informe nome e telefone para cadastrar.'); } else throw e; }
    });
  }
  async function cadastrar() {
    await act(async () => {
      try { const c = await api.criarCliente({ cpf, nome, telefone }); setCliente(c); setNovo(false); setStatus('Cliente cadastrado. Escolha a mesa e informe o cartão.'); }
      catch (e) {
        if (e instanceof ApiError && e.code === 'CPF_DUPLICADO') { const c = await api.buscarCliente(cpf); setCliente(c); setNome(c.nome); setNovo(false); setStatus('Cadastro existente recuperado.'); }
        else throw e;
      }
    });
  }
  async function mostrarCodigo(codigo: string) {
    const image = await QRCode.toDataURL(codigo, { width: 260, margin: 2, errorCorrectionLevel: 'M' });
    setQr(image);
  }
  async function abrir() {
    await act(async () => {
      if (!cliente || !mesa || !/^[0-9]{5}$/.test(codigoCartao)) return;
      const result = await api.abrir({ idCliente: cliente.idCliente, idMesa: mesaId, codigoCartao,
        confirmarMesaOcupada: confirmar }, chave.current);
      setAtendimento(result); setStatus('Comanda ' + result.idComanda + ' aberta com sucesso.');
      // Falha ao renderizar cartão não deve esconder uma abertura já concluída.
      try { if (result.codigoCartao) await mostrarCodigo(result.codigoCartao); await refresh(); setStatus('Comanda ' + result.idComanda + ' aberta com sucesso.'); }
      catch (e) { setError('Comanda aberta. ' + message(e) + ' Use Reexibir cartão ou Atualizar mapa.'); }
    });
  }
  function limpar() {
    alterarCpf(''); setMesaId(0); setCodigoCartao(''); setConfirmar(false); setDetalhe(null); setConfirmarLiberacao(false); setError(''); setStatus('Pronto para o próximo atendimento.');
  }
  return <AppShell title="Recepção">
    <div className="heading-row"><div><p className="eyebrow">Atendimento • Sprint 01</p><h1>Receber bem começa aqui.</h1><p>Localize o cliente, escolha a mesa e entregue seu cartão.</p></div><Button className="secondary" disabled={busy} onClick={() => void act(refresh)}>Atualizar mapa</Button></div>
    <p role="status" className="notice">{status}</p>{error && <p role="alert" className="notice error">{error}</p>}
    <div className="reception-grid">
      <section className="panel"><p className="eyebrow">01 / Cliente</p><h2>Quem chegou?</h2>
        <form onSubmit={e => { e.preventDefault(); void buscar(); }}>
          <label htmlFor="cpf">CPF do cliente</label><div className="inline"><input id="cpf" value={cpf} onChange={e => alterarCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} disabled={busy || !!atendimento} autoComplete="off" required /><Button disabled={busy || !!atendimento}>Buscar</Button></div>
        </form>
        {novo && !cliente && <form onSubmit={e => { e.preventDefault(); void cadastrar(); }}><label htmlFor="nome">Nome completo</label><input id="nome" value={nome} onChange={e => setNome(e.target.value)} maxLength={120} disabled={busy} required /><label htmlFor="telefone">Telefone</label><input id="telefone" type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} maxLength={32} disabled={busy} required /><Button disabled={busy || !nome.trim() || !telefone.trim()}>Cadastrar cliente</Button></form>}
        {cliente && <div className="client-summary"><span className="tag">Cliente selecionado</span><h3>{cliente.nome}</h3><p>CPF {mascararCpf(normalizarCpf(cliente.cpf))}</p></div>}
        <hr /><p className="eyebrow">03 / Cartão físico</p><label htmlFor="cartao">Código impresso no cartão</label><input id="cartao" value={codigoCartao} inputMode="numeric" maxLength={5} placeholder="Ex.: 01234" disabled={busy || !!atendimento} onChange={e => { setCodigoCartao(e.target.value.replace(/\D/g, '')); chave.current = crypto.randomUUID(); }} />
        <p className="muted">Informe os cinco dígitos do cartão entregue ao cliente. Cartões em uso serão recusados.</p>
        <div className="selection-summary"><p>Cliente: <strong>{cliente?.nome ?? 'Selecione o cliente'}</strong></p><p>Mesa: <strong>{mesa ? 'Mesa ' + mesa.numero : 'Selecione no mapa'}</strong></p></div>
        {mesa?.status === 'OCUPADA' && !atendimento && <label className="checkbox"><input type="checkbox" checked={confirmar} disabled={busy} onChange={e => { setConfirmar(e.target.checked); chave.current = crypto.randomUUID(); }} />Confirmo incluir outro cliente nesta mesa ocupada.</label>}
        <Button className="wide" disabled={busy || !!atendimento || !cliente || !mesa || !/^[0-9]{5}$/.test(codigoCartao) || (mesa.status === 'OCUPADA' && !confirmar) || mesa.status === 'MANUTENCAO'} onClick={() => void abrir()}>{busy ? 'Processando…' : 'Abrir comanda'}</Button>
      </section>
      <section className="panel"><p className="eyebrow">02 / Salão</p><h2>Mapa de mesas</h2><div className="legend">{Object.entries(labels).map(([s, label]) => <span key={s}><i className={'dot ' + s.toLowerCase()} />{label}</span>)}</div>
        <div className="table-grid">{mesas.map(m => <button key={m.idMesa} className={'table-card ' + m.status.toLowerCase() + (mesaId === m.idMesa ? ' selected' : '')} aria-pressed={mesaId === m.idMesa} disabled={busy || !!atendimento || m.status === 'MANUTENCAO'} onClick={() => { setMesaId(m.idMesa); setConfirmar(false); setDetalhe(null); setConfirmarLiberacao(false); chave.current = crypto.randomUUID(); }}>
          <span className="table-number">Mesa {String(m.numero).padStart(2, '0')}</span><span>{labels[m.status]}</span><small>{m.comandasAtivas} {m.comandasAtivas === 1 ? 'comanda ativa' : 'comandas ativas'}</small>
        </button>)}</div>
        {!mesas.length && <p>Nenhuma mesa carregada. Confira a conexão e o seed do banco.</p>}
        <p className="muted">Mesas livres e reservadas podem receber clientes. Mesas ocupadas exigem confirmação; manutenção bloqueia o atendimento.</p>
        {mesa && !atendimento && <div className="table-actions">
          <Button className="secondary" disabled={busy} onClick={() => void act(async () => { setDetalhe(await api.detalheMesa(mesaId)); })}>Ver atendimentos</Button>
          {mesa.status === 'LIVRE' && <Button className="secondary" disabled={busy} onClick={() => void act(async () => { await api.reservar(mesaId); await refresh(); })}>Reservar mesa</Button>}
          {mesa.status !== 'LIVRE' && mesa.status !== 'MANUTENCAO' && <Button className="secondary" disabled={busy} onClick={() => setConfirmarLiberacao(true)}>Liberar mesa</Button>}
        </div>}
        {detalhe && <div className="details"><h3>Atendimentos da mesa {detalhe.numero}</h3>{detalhe.atendimentos.length ? detalhe.atendimentos.map(a => <p key={a.idComanda}><strong>#{a.idComanda} · {a.nomeCliente}</strong><br />CPF {a.cpfMascarado} · Cartão {a.codigoCartao ?? 'Legado'}</p>) : <p>Nenhuma comanda ativa.</p>}</div>}
        {confirmarLiberacao && mesa && <div className="notice error"><h3>Liberar mesa {mesa.numero}?</h3><p>Esta ação encerra todas as comandas ativas, libera os cartões e encerra os acessos desta mesa. Não registra pagamento.</p><div className="table-actions"><Button disabled={busy} onClick={() => void act(async () => { const r = await api.liberar(mesaId); setConfirmarLiberacao(false); setDetalhe(null); setConfirmar(false); await refresh(); setStatus('Mesa liberada. ' + r.comandasEncerradas + ' comandas encerradas.'); })}>Confirmar liberação</Button><Button className="secondary" disabled={busy} onClick={() => setConfirmarLiberacao(false)}>Cancelar</Button></div></div>}
      </section>
    </div>
    {atendimento && <section className="panel success"><div className="heading-row"><div><p className="eyebrow">Atendimento aberto</p><h2>Comanda #{atendimento.idComanda}</h2><p>{cliente?.nome} · Mesa {mesa?.numero} · Status aberta</p></div><Button onClick={limpar} disabled={busy}>Próximo cliente</Button></div>
      {atendimento.codigoCartao && <div className="card-identification">{qr && <img src={qr} alt={'QR Code do cartão ' + atendimento.codigoCartao} width={260} height={260} />}<div><h3>Cartão {atendimento.codigoCartao}</h3><p>Escaneie no aplicativo da mesa ou digite o código:</p><code className="access-code">{atendimento.codigoCartao}</code><p className="muted">Este código é fixo do cartão. Só o atendimento ativo permite acesso.</p></div></div>}
      <Button className="secondary" disabled={busy || !atendimento.codigoCartao} onClick={() => void act(() => mostrarCodigo(atendimento.codigoCartao!))}>Reexibir cartão</Button>
    </section>}
  </AppShell>;
}

