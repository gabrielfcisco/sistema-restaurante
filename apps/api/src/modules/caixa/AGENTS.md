# Caixa na API — estrutura da Sprint 4

**Estado em 25/11/2026:** US-20/22/23/24/25/26 implementadas. O estado e contratos finais ao fim de `docs/sprint-04.md` (na raiz) prevalecem sobre as notas históricas de preparação abaixo. Preservar as regras e restrições de escopo.

Módulo reservado para US-23/24 e integração US-25. Ainda não há rotas ou serviço; não registrar endpoints vazios. Leia `docs/sprint-04.md` e `docs/contratos-api.md` na raiz, além de `apps/api/AGENTS.md`.

Sem login, somente na rede interna. Centralizar consulta de conta, composição de taxas, pré-conta e pagamento na API comum. Não duplicar totais/extrato em frontend. Garçom recebe fisicamente; a preparação orienta confirmação da quitação pelo caixa após retorno. Gerar pré-conta e chamar garçom não quitam nem liberam a mesa.

Taxas opcionais: nome e percentual sobre consumo ou valor fixo por comanda. Nenhuma ativa por padrão; preservar valores aprovados na pré-conta e pagamento. Formas: dinheiro, Pix, débito e crédito; sem integração bancária, uma forma e pagamento integral por comanda.

Pagamento somente com itens entregues e conta solicitada; unicidade persistida, status revalidado sob lock e rollback integral. Finalizar somente a comanda paga e liberar mesa só sem outras comandas ativas. Não chamar a liberação manual que encerra todas as comandas. Preservar histórico, sessões/cartão e chamadas conforme regras da sprint.

Antes de adicionar migration, conferir schema e transações existentes. Não alterar migrations aplicadas; não executar no banco de operação. Usar DTOs/cliente compartilhados, erros existentes, eventos após commit e testes de concorrência em banco descartável.
