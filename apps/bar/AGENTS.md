# Módulo Bar — Grupo 9

Este app Electron/Vite já implementa a US-13. Leia o `AGENTS.md` da raiz, `docs/us-12-us-13.md`, `docs/sprint-03.md`, os contratos/serviços atuais e as capturas em `screenshots/` antes de alterar o fluxo. Não invente interface se não houver captura.

- US-13 existente consulta itens não entregues do setor BAR (`RECEBIDO`, `EM_PREPARO`, `PRONTO`) via SSE. Na Sprint 3 (US-14), o painel poderá avançar somente `RECEBIDO → EM_PREPARO → PRONTO`; o garçom marcará `ENTREGUE`. Mostrar itens prontos até o garçom concluir a entrega. Preservar status agregado do Pedido (estágio menos avançado dos itens), rede interna e ausência de login. Não alterar funcionalmente até solicitação explícita; contratos em `docs/sprint-03.md`.
