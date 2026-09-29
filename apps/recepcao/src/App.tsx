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
  return <AppShell title="Recepção">
    <p className="eyebrow">Recepção</p>
    <h1>Tudo pronto para receber.</h1>
    <p>O cadastro de clientes, o mapa de mesas e a atribuição de comandas estarão disponíveis em breve.</p>
    <section className="panel" aria-label="Conexão com o servidor"><p role="status">{message}</p><Button onClick={checkConnection} disabled={busy}>{busy ? 'Verificando…' : 'Verificar conexão'}</Button></section>
  </AppShell>;
}

