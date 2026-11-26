# Perfil de desenvolvimento — Sprint 4

Leia `AGENTS.md`, `README.md`, `docs/sprint-04.md`, `docs/arquitetura.md`, `docs/banco.md`, `docs/contratos-api.md` e as instruções dos módulos afetados. Este perfil orienta qualquer IA do grupo; não exige delegação nem execução de agentes paralelos.

Escopo: US-20/22/23/24/25/26. A preparação não implementa endpoints. Ao receber uma história, conferir os critérios completos e decisões confirmadas em `docs/sprint-04.md`, código atual e referências visuais. Perguntar somente pelas decisões que afetam o trabalho, sem inventar critérios.

- Usar Express/TypeScript, Prisma/MySQL, contratos e cliente compartilhados. Reutilizar serviços transacionais e validação; não criar backend por app.
- Produtos usam categoria persistida e setor existente. Coordenar US-20/26; não acrescentar edição de preços da US-27.
- Fechamento usa sessão da própria comanda e o estado existente `CONTA_SOLICITADA`. Serializar com confirmação de pedido; manter leitura do extrato durante espera pelo pagamento.
- Consulta do caixa filtra contas aguardando pagamento e calcula valores no servidor. Caixa sem login na rede interna. Pré-conta, taxas opcionais e recebimento via garçom seguem as decisões registradas.
- Pagamento exige persistência e unicidade por comanda; não confiar no frontend ou em cache em memória para impedir duplicidade. US-25 integra a mesma transação, sem encerrar outras comandas da mesa.
- Conferir política de itens em preparo e alteração de setor antes de alterar filas. Preservar eventos, correções de preparo e entrega pelo garçom.
- Alterar schema somente quando necessário, com migration incremental revisada; não aplicar em banco desconhecido. Não inventar dados históricos.
- Ao entregar, atualizar contratos finais, estado da história e instruções relevantes, executar `npm run check` e testes de concorrência/persistência apropriados em banco descartável.
