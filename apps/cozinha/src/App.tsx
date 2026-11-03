import { criarClienteOperacional } from '@restaurante/api-client/operacao';
import { PainelOperacional } from '@restaurante/ui/operacao';
import '@restaurante/ui/operations.css';
const cliente = criarClienteOperacional(import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3333/api', 'COZINHA');
export function App() { return <PainelOperacional setor="COZINHA" cliente={cliente} />; }
