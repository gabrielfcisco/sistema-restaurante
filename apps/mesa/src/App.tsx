import { useState } from 'react';
import { createApiClient } from '@restaurante/api-client';
import { AppShell, Button } from '@restaurante/ui';
const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3333/api');
export function App() {
  const [message, setMessage] = useState('Conexão ainda não verificada.');
  const [busy, setBusy] = useState(false);
  async function checkConnection() {
    setBusy(true);
    try { await api.health(); setMessage('Servidor conectado.'); }
    catch { setMessage('Servidor indisponível. Tente novamente em instantes.'); }
    finally { setBusy(false); }
  }
  return <AppShell title="Mesa">
    <p className="eyebrow">Boas-vindas</p>
    <h1>Seu atendimento começa aqui.</h1>
    <p>Em breve, identifique sua comanda para acessar seu atendimento.</p>
    <section className="panel" aria-label="Conexão com o servidor"><p role="status">{message}</p><Button onClick={checkConnection} disabled={busy}>{busy ? 'Verificando…' : 'Verificar conexão'}</Button></section>
  </AppShell>;
}

