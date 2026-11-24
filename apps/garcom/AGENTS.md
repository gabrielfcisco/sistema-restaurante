# Garçom — Sprint 3

US-15/17/18 integradas à API comum na rede interna. Usar contratos e cliente compartilhados. Manter consulta de mesa/comanda, confirmação de entrega e chamados pendentes no mesmo painel. Consultar as capturas versionadas e docs/sprint-03.md. Nunca simular sucesso.

Sprint 4: consultar `docs/sprint-04.md` para o fluxo caixa → garçom → recebimento na mesa. Preservar eventos existentes `fila` e `chamados`; solicitação de conta deve ser identificada por comanda, pois a mesa pode ter vários clientes. Não tratar chamada genérica por mesa como persistência suficiente da conta solicitada. A orientação adotada é o caixa confirmar o pagamento após retorno do garçom; receber fisicamente e registrar quitação são ações distintas. Concluir um aviso não paga a comanda.
