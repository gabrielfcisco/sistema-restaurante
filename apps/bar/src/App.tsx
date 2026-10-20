import { AppShell } from '@restaurante/ui';

export function App() {
  return <AppShell title="Bar">
    <section className="station-panel">
      <p className="eyebrow">Grupo 9 · Sprint 2</p>
      <h1>Painel do bar</h1>
      <p>O aplicativo do bar está pronto para iniciar. A fila de preparo será conectada à API nas histórias US-13.</p>
      <p className="station-status"><span aria-hidden="true" /> Tela inicial carregada</p>
    </section>
  </AppShell>;
}
