import { AppShell } from '@restaurante/ui';

export function App() {
  return <AppShell title="Cozinha">
    <section className="station-panel">
      <p className="eyebrow">Grupo 9 · Sprint 2</p>
      <h1>Painel da cozinha</h1>
      <p>O aplicativo da cozinha está pronto para iniciar. A fila de preparo será conectada à API nas histórias US-12.</p>
      <p className="station-status"><span aria-hidden="true" /> Tela inicial carregada</p>
    </section>
  </AppShell>;
}
