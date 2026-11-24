import { Button } from '@restaurante/ui';
import { useState } from 'react';

type Visao = 'conta' | 'preconta';

// Preparação visual: nenhum dado abaixo representa uma comanda do banco.
export function App() {
  const [visao, setVisao] = useState<Visao>('conta');
  const [forma, setForma] = useState('PIX');
  return <div className="caixa-app">
    <header className="caixa-topbar"><div className="caixa-brand"><span className="caixa-mark" aria-hidden="true">M</span><h1>Caixa</h1></div><span className="caixa-badge">Prévia da Sprint 4</span></header>
    <main className="caixa-main">
      <aside className="preview-notice" role="note"><strong>Demonstração visual</strong><p>Dados ilustrativos. Esta prévia não consulta contas, chama garçons, emite documentos ou registra pagamentos.</p></aside>
      <nav className="caixa-tabs" aria-label="Visualização"><Button className={'acao ' + (visao === 'conta' ? '' : 'acao-secundaria')} aria-pressed={visao === 'conta'} onClick={() => setVisao('conta')}>Conferir conta</Button><Button className={'acao ' + (visao === 'preconta' ? '' : 'acao-secundaria')} aria-pressed={visao === 'preconta'} onClick={() => setVisao('preconta')}>Pré-conta</Button></nav>
      <div className="caixa-grid">
        <section className="caixa-card"><h2>Aguardando pagamento</h2><p>Comanda 1024 · Mesa 08 · Cliente de exemplo</p><span className="caixa-status">R$ 120,00 em consumo</span><p className="caixa-muted">Forma informada pelo cliente: Pix</p></section>
        <section className="caixa-card"><h2>Detalhe da conta</h2><p>Pedido 5801 · Itens entregues</p><ul className="caixa-itens"><li><span>2× Filé ao molho</span><strong>R$ 96,00</strong></li><li><span>2× Suco de laranja</span><strong>R$ 24,00</strong></li></ul><div className="caixa-total"><span>Consumo</span><strong>R$ 120,00</strong></div></section>
      </div>
      {visao === 'conta' ? <div className="caixa-grid">
        <section className="caixa-card"><h2>Forma de pagamento</h2><label htmlFor="forma-pagamento">Forma informada</label><select id="forma-pagamento" value={forma} onChange={e => setForma(e.target.value)}><option value="DINHEIRO">Dinheiro</option><option value="PIX">Pix</option><option value="DEBITO">Débito</option><option value="CREDITO">Crédito</option></select><p>O garçom recebe na mesa. O caixa confere o recebimento antes de finalizar.</p><Button className="acao" disabled>Confirmar pagamento</Button></section>
        <section className="caixa-card"><h2>Taxas da pré-conta</h2><p>Nenhuma taxa selecionada. O caixa poderá incluir serviço ou música por comanda.</p><fieldset disabled><legend>Adicionar taxa</legend><label htmlFor="nome-taxa">Nome</label><input id="nome-taxa" placeholder="Ex.: serviço" /><div className="caixa-fields"><div><label htmlFor="tipo-taxa">Tipo</label><select id="tipo-taxa"><option>Percentual do consumo</option><option>Valor fixo em reais</option></select></div><div><label htmlFor="valor-taxa">Valor</label><input id="valor-taxa" type="number" min="0" step="0.01" /></div></div></fieldset><Button className="acao acao-secundaria" disabled>Adicionar taxa</Button></section>
      </div> : <section className="caixa-card preconta"><h2>Pré-conta</h2><p>Documento de conferência · Sem valor fiscal</p><p>Mesa 08 · Comanda 1024 · Cliente de exemplo</p><ul className="caixa-itens"><li><span>2× Filé ao molho · R$ 48,00/un.</span><strong>R$ 96,00</strong></li><li><span>2× Suco de laranja · R$ 12,00/un.</span><strong>R$ 24,00</strong></li><li><span>Taxas</span><strong>R$ 0,00</strong></li></ul><div className="caixa-total"><span>Total da pré-conta</span><strong>R$ 120,00</strong></div><p>Pagamento informado: {({ DINHEIRO: 'Dinheiro', PIX: 'Pix', DEBITO: 'Débito', CREDITO: 'Crédito' })[forma]}</p><p>A emissão da pré-conta não confirma o pagamento.</p><div className="caixa-actions"><Button className="acao" disabled>Imprimir</Button><Button className="acao acao-secundaria" disabled>Baixar PDF</Button><Button className="acao acao-secundaria" disabled>Chamar garçom</Button></div></section>}
      <section className="caixa-card"><h2>Finalização e histórico</h2><p>A quitação será registrada apenas após o recebimento e com todos os itens entregues. A mesa será liberada quando não houver outra comanda ativa.</p><p className="caixa-muted">Nenhum pagamento foi registrado nesta demonstração.</p></section>
    </main>
  </div>;
}
