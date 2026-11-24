# Módulo Cozinha — Grupo 9

Regra atual de correção no preparo: cozinha e bar podem mover um item do próprio setor uma etapa por vez, nos dois sentidos: RECEBIDO ↔ EM_PREPARO ↔ PRONTO. Arrastar e os botões usam o mesmo PATCH com o status de origem. Voltar de PRONTO retira o item da fila do garçom; ENTREGUE permanece final. Esta regra prevalece sobre a descrição histórica abaixo.

Atualização US-15: PRONTO permanece na fila com aviso de retirada; somente o garçom confirma ENTREGUE. O serviço/API rejeita entrega pelo setor. Demais fluxos US-12 são preservados.

Este app Electron/Vite já implementa a US-12. Leia o `AGENTS.md` da raiz, `docs/us-12-us-13.md`, `docs/sprint-03.md`, os contratos/serviços atuais e as capturas em `screenshots/` antes de alterar o fluxo. Não invente interface se não houver captura.

US-12 existente consulta itens não entregues do setor COZINHA (`RECEBIDO`, `EM_PREPARO`, `PRONTO`) via SSE. Na Sprint 3 (US-14), o painel poderá avançar somente `RECEBIDO → EM_PREPARO → PRONTO`; o garçom marcará `ENTREGUE`. Mostrar itens prontos até o garçom concluir a entrega. Preservar status agregado do Pedido (estágio menos avançado dos itens), rede interna e ausência de login. Não alterar funcionalmente até solicitação explícita; contratos em `docs/sprint-03.md`.
