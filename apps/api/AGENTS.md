# API comum — Grupo 9

Leia `AGENTS.md` da raiz, `docs/arquitetura.md`, `docs/banco.md`, `docs/contratos-api.md` e `docs/sprint-04.md`. Sprint 3 está integrada; suas propostas históricas não indicam funcionalidades pendentes. Rotas ficam nos módulos e são montadas por `sprint-routes.ts` e `app.ts`. Preservar `Cache-Control: no-store`, validação, erros e contratos reais.

- Garçom/administração/cozinha/bar/caixa sem login, somente em rede interna, conforme decisões confirmadas. CORS não restringe a rede por si só.
- Cozinha/bar corrigem etapas vizinhas até PRONTO; garçom entrega. Reutilizar serviço operacional e eventos, sem duplicar regras.
- Sessão da mesa validada no servidor, incluindo vínculo e estado. SSE autenticado e escopado à comanda; bearer nunca em URL.
- Mesa pode ter várias comandas. Chamadas mantêm uma pendência por mesa. Categorias já são relacionais; inativação preserva produtos/histórico e bloqueia novos pedidos.
- Totais atuais usam todos os pedidos confirmados e preço do Produto. Não implementar US-27 nem alterar a regra de preço estável incidentalmente.

Sprint 4: implementar apenas a história solicitada. Propostas de rotas, dados, transações e testes em `docs/sprint-04.md`; pendências não são decisões confirmadas. US-20/26 pertencem à administração; US-22 à comanda autenticada; US-23/24 ao caixa; US-25 à mesma transação de pagamento. Não duplicar finalização nem chamar liberação manual de todas as comandas ao pagar uma.

`CONTA_SOLICITADA` e bloqueio de pedido já existem. Persistência de pagamento não existe e exige migration incremental quando US-24 for implementada. Unicidade por comanda deve resistir a concorrência/reinício. Lock da mesa deve serializar operações com abertura, pedidos e pagamento; revalidar estado na transação. Eventos só após commit. Não aplicar migrations em banco desconhecido.

Contratos em `packages/contracts`, cliente em `packages/api-client`. Atualizar rotas finais e estado da história, executar `npm run check` e testes MySQL descartáveis pertinentes, preservando testes existentes.
