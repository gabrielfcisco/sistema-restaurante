# Garçom — preparação Sprint 3 (Grupo 9)

Este é um workspace web responsivo para navegador móvel, com prévia visual das US-15/17/18. Ainda não consome a API e não executa ações reais. Histórias previstas: retirada/entrega, consulta de mesa/comanda e fila de chamadas. Leia `../../AGENTS.md` e `../../docs/sprint-03.md` antes de alterar o app.

Decisões confirmadas: app e rotas sem login somente na rede interna; listar todas as comandas ativas da mesa para seleção; mostrar itens `PRONTO` de cozinha e bar e permitir ao garçom avançar a `ENTREGUE`; manter uma chamada pendente por mesa, sem duplicar acionamentos. A liberação da mesa cancela chamadas pendentes. A query `?preview=1` mostra itens ilustrativos e nunca persiste alterações; sem ela, mostrar estados vazios. Não acessar Prisma diretamente: integrar à API comum com `packages/api-client` e DTOs de `packages/contracts` quando houver solicitação para implementar.

Consulte `screenshots/` e as referências Figma disponíveis antes de implementar interface. Pasta sem capturas significa que ainda não há referência visual versionada; não inventar telas.
