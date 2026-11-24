# Caixa — preparação da Sprint 4

Leia `../../AGENTS.md`, `../../docs/sprint-04.md` e `../../docs/figma-sprint-04.md`. App Electron/Vite separado, porta 5179, sem login e exclusivamente na rede interna, conforme decisão do responsável. API comum; nunca criar backend próprio. `src/App.tsx` é uma prévia local, com dados explicitamente ilustrativos e sem persistência. Implementar US-23/24 somente quando solicitadas; US-25 integra a mesma transação de pagamento.

Cliente solicita a conta e informa uma forma de pagamento. Caixa prepara a pré-conta, escolhe taxas opcionais e chama o garçom, que recebe na mesa. A orientação de preparação é o caixa confirmar a quitação após retorno do garçom. Gerar/imprimir pré-conta e chamar garçom não significam pagamento. Não emitir documento fiscal nem integrar banco/adquirente. Formas: dinheiro, Pix, débito e crédito; pagamento integral, uma forma por comanda.

Taxas: nome, percentual sobre consumo ou valor fixo em reais por comanda; nenhuma ativa por padrão. Cálculos, conta e confirmação finais devem vir do backend; prévia não autoriza cálculo financeiro apenas no frontend. Preservar versão/valores da pré-conta e pagamento, e perguntar antes de introduzir rateio, desconto, estorno ou outras regras.

Pagamento só com todos os itens entregues. Liberar mesa somente após a última comanda ativa; não encerrar outras comandas nem usar liberação manual da recepção. Preservar histórico, unicidade de pagamento, revogação das sessões e liberação do cartão correto. Nunca simular confirmação de pagamento. Ao integrar, remover dados de demonstração do fluxo operacional.

Referência real em `screenshots/figma-caixa.png`, Figma `4:1654`. Taxas/pré-conta são adaptações autorizadas seguindo o padrão existente; o protótipo não detalha esse fluxo. Reutilizar componentes e contratos compartilhados. Manter isolamento/sandbox do Electron e permissões negadas por padrão; impressão futura deve ser restrita à pré-conta, sem bridge genérico para arquivos ou execução.
