# Módulo Mesa — Grupo 9

**Estado em 25/11/2026:** US-20/22/23/24/25/26 implementadas. O estado e contratos finais ao fim de `docs/sprint-04.md` (na raiz) prevalecem sobre as notas históricas de preparação abaixo. Preservar as regras e restrições de escopo.

Leia o `AGENTS.md` da raiz e as referências em `screenshots/` e Figma antes de alterar interface. Este app React/Vite/Electron é cliente HTTP; não importa banco, Prisma, segredos, Node ou internals de outros apps. Reutilize `ui`, `api-client` e `contracts`. Mantenha português e Electron seguro.

Base integrada: identificação por cartão/sessão, cardápio/categorias persistidas, confirmação de pedidos, acompanhamento US-16, chamado US-18 e extrato US-21. Preservar SSE autenticado por header, escopado à própria comanda, com snapshot na abertura/reconexão. Chamado pendente não duplica; extrato inclui todos os pedidos confirmados, inclusive em preparo. Categorias inativas bloqueiam catálogo e confirmação na API. Preços permanecem estáveis durante operação.

Sprint 4: US-22 adicionará solicitação de fechamento; ler `../../docs/sprint-04.md`. A API já bloqueia pedidos em `CONTA_SOLICITADA`, mas a ação de solicitar a conta ainda não existe. Implementar somente quando a história for solicitada, usando sessão vinculada. Desabilitar novos pedidos após confirmação real e tratar conflitos de pedido/fechamento. Solicitar conta não registra pagamento nem libera mesa. Preservar consulta do extrato e acompanhamento durante espera. Não implementar reabertura/cancelamento sem decisão.

Trocar cliente limpa dados e token locais sem encerrar a comanda. Pagamento futuro deverá revogar sessões no servidor; preservar revalidação existente e não exibir dados do cliente anterior.

## Ajustes solicitados em 26/11/2026

O responsável autorizou edição completa e exclusão de produtos, envio de fotos, exclusão de categorias e consulta do histórico de pagamentos. Estas decisões substituem as restrições anteriores sobre esse escopo. ItemPedido preserva nome/preço no momento da confirmação; não voltar a recalcular pedidos pelo preço atual do cadastro. A migration incremental `20261126000000_gestao_produtos` registra os valores disponíveis dos itens existentes. Produtos excluídos ficam fora da gestão e do cardápio, mantendo relações históricas. Categorias com produtos vinculados não podem ser excluídas. Conta com consumo zero não pode ser solicitada, emitida ou paga.
