import { useEffect, useRef, useState } from 'react';
import { ApiError, createApiClient } from '@restaurante/api-client';
import type { SessaoMesaDto } from '@restaurante/contracts';
import { AppShell, Button } from '@restaurante/ui';
import { browserCamera } from './platform/camera';
const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3333/api');
export function TableAccess() {
  const [codigo, setCodigo] = useState(''), [session, setSession] = useState<SessaoMesaDto | null>(null);
  const [error, setError] = useState(''), [status, setStatus] = useState('Use seu cartão para identificar o atendimento.');
  const [busy, setBusy] = useState(false), [scanning, setScanning] = useState(false), [offline, setOffline] = useState(false);
  const [admin, setAdmin] = useState(false), [numero, setNumero] = useState('');
  const [mesaAtual, setMesaAtual] = useState<number | null>(null);
  const video = useRef<HTMLVideoElement>(null), stopCamera = useRef<(() => void) | null>(null);
  const generation = useRef(0), locked = useRef(false);
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
      const s = await api.acessar(value.trim()); setSession(s); setCodigo(''); setOffline(false); setStatus('Atendimento identificado.');
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
    const expire = setTimeout(() => { setSession(null); setCodigo(''); setError('Sua sessão expirou. Identifique o cartão novamente.'); }, Math.max(0, new Date(session.expiraEm).getTime() - Date.now()));
    const check = async () => {
      try { await api.sessao(session.token); if (active) { setOffline(false); setError(''); } }
      catch (e) {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) { setSession(null); setCodigo(''); setError(e.message); }
        else { setOffline(true); setError('Servidor indisponível. Atendimento temporariamente bloqueado até reconectar.'); }
      }
    };
    const timer = setInterval(() => void check(), 15000);
    void check();
    return () => { active = false; clearInterval(timer); clearTimeout(expire); };
  }, [session]);
  async function sair() {
    if (!session) return;
    const token = session.token;
    stop(); setSession(null); setCodigo(''); setError(''); setOffline(false); setStatus('Sessão removida deste dispositivo. Próximo cliente, identifique seu cartão.');
    try { await api.sair(token); }
    catch { setError('Dados removidos deste dispositivo. Sem conexão para revogar no servidor; a sessão expira automaticamente.'); }
  }
  return <AppShell title="Mesa">
    {admin ? <section className="panel welcome"><p className="eyebrow">Configuração do dispositivo</p><h1>Alterar mesa</h1><p>Mesa atual: <strong>{mesaAtual}</strong>. Este número define quais comandas podem acessar este dispositivo.</p>
      {error && <p role="alert" className="notice error">{error}</p>}
      <form onSubmit={e => { e.preventDefault(); void salvarMesa(); }}><label htmlFor="numero-mesa">Número da mesa</label><input id="numero-mesa" type="number" min={1} max={4294967295} step={1} value={numero} onChange={e => setNumero(e.target.value)} disabled={busy} autoFocus required /><div className="table-actions"><Button disabled={busy || !/^[1-9]\d*$/.test(numero) || Number(numero) > 4294967295}>{busy ? 'Salvando…' : 'Salvar mesa'}</Button><Button type="button" className="secondary" disabled={busy} onClick={() => { setAdmin(false); setError(''); setStatus('Use seu cartão para identificar o atendimento.'); }}>Cancelar</Button></div></form>
    </section> : session ? <section className="panel welcome"><p className="eyebrow">Atendimento identificado</p><h1>Olá, {session.nomeCliente}.</h1><p className="session-number">Comanda #{session.idComanda} · Mesa {session.numeroMesa} · Cartão {session.codigoCartao}</p>
      <p role="status">{offline ? 'Aguardando conexão com o servidor.' : 'Seu cartão foi validado para esta mesa.'}</p>
      {error && <p role="alert" className="notice error">{error}</p>}
      {!offline && <div className="menu-gateway"><h2>Bem-vindo ao seu atendimento</h2><p>Acesso à comanda liberado. O cardápio e os pedidos serão disponibilizados na próxima sprint.</p></div>}
      <Button className="secondary" onClick={() => void sair()}>Sair / trocar cliente</Button><p className="muted">Sair remove seu acesso do dispositivo e mantém a comanda aberta.</p>
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

