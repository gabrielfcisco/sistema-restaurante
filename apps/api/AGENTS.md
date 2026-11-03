# API — preparação Sprint 3 (Grupo 9)

Leia o `AGENTS.md` da raiz, `docs/arquitetura.md`, `docs/banco.md`, `docs/contratos-api.md`, `docs/sprint-02.md`, `docs/us-12-us-13.md` e `docs/sprint-03.md` antes de qualquer implementação. As rotas Sprint 3 em `docs/sprint-03.md` são candidatas documentadas, ainda não estão implementadas. Só implementar após solicitação explícita.

## Regras confirmadas

- Garçom/gerente sem login, limitados à rede interna; validar dados e minimizar DTOs mesmo dentro da rede.
- Cozinha/bar avançam item até `PRONTO`; garçom conclui `PRONTO → ENTREGUE` nos dois setores. Atualizar status agregado do Pedido na mesma transação; publicar atualização às filas e sessão da comanda correta.
- Cliente usa token de sessão existente e a API verifica vínculo atual. Eventos SSE de US-16 sempre ficam escopados à comanda da sessão autenticada.
- Garçom lista todas as comandas ativas da mesa e seleciona; chamadas de garçom têm no máximo uma pendente por mesa e tentativas repetidas retornam a existente.
- US-19 migra o enum de categoria para entidade dinâmica, com categorias iniciais `PRATO`, `SOBREMESA`, `BEBIDA`; inativar categoria oculta produtos sem apagar produtos nem histórico.
- Nomes de categoria são obrigatórios, aparados e únicos sem diferenciar maiúsculas/minúsculas. Na liberação da mesa, cancelar chamadas pendentes atomicamente e preservar histórico.
- US-17/21 somam todos os itens persistidos de pedidos confirmados, inclusive em preparo, pela quantidade e preço de Produto, estável durante operação.

Use transações e lock de mesa para serializar a criação/repetição de chamadas e a entrega concorrente. Para SSE autenticado, não colocar bearer na URL; usar conexão streaming autorizada por header. Alterações de banco são migrations incrementais revisadas; não executar `db:deploy` em banco desconhecido. Manter contratos em `packages/contracts` e consumidores via `packages/api-client`.

Questões residuais estão marcadas em `docs/sprint-03.md`; resolva-as sem inventar regras de negócio e atualize documentação/testes ao implementar.
