# Perfil de agente — preparação/rotas da Sprint 3 (Grupo 9)

Antes de implementar, leia `AGENTS.md`, `README.md`, `docs/arquitetura.md`, `docs/banco.md`, `docs/contratos-api.md`, `docs/sprint-02.md`, `docs/us-12-us-13.md` e `docs/sprint-03.md`, além dos módulos afetados.

## Limite atual

As US-14, US-15, US-16, US-17, US-18, US-19 e US-21 foram transcritas da planilha oficial. As decisões principais foram confirmadas e estão registradas em `docs/sprint-03.md`, junto aos contratos candidatos. Esta entrega é preparação documental: implemente somente quando houver solicitação explícita. Confirme no documento quaisquer questões residuais antes de fixar comportamento além dos critérios.

## Arquitetura

- API Express/TypeScript única em `apps/api`; rotas finas, validação na borda, serviço para regras/transações; Prisma/MySQL; DTOs em `packages/contracts`; cliente comum em `packages/api-client`.
- Reutilizar cozinha/bar e seu serviço de status para US-14/15, sem duplicar transições no frontend. Cozinha/bar avançam até `PRONTO`; o garçom é responsável por `ENTREGUE`.
- Validar sessão da mesa e vínculo ativo com a comanda em todas as leituras/escritas do cliente (US-16, US-18 e US-21). Nunca confiar em ID de comanda isoladamente.
- Garçom/gerente operam sem login, somente na rede interna. Configurar deploy para limitar API às interfaces internas; não expor dados pessoais desnecessários.
- Na consulta por mesa, listar todas as comandas ativas para o garçom selecionar uma.
- US-18 mantém no máximo uma chamada pendente por mesa; acionamento repetido retorna a chamada existente.
- US-19 usa categorias dinâmicas com as categorias iniciais atuais; inativação oculta produtos sem apagá-los. A migration deve preservar o catálogo e preparar produtos/categorias para novos DTOs.
- US-16 usa SSE autenticado e escopado à comanda da sessão para evitar polling frequente; GET fornece snapshot na abertura/reconexão. Não colocar token em query string.
- US-21 e o total parcial da US-17 somam todos os itens persistidos de pedidos confirmados, independentemente do status; rascunhos não entram. Usar preço vigente do Produto, estável durante a operação; calcular com precisão decimal/centavos.
- Evento de status deve chegar ao painel de retirada e à sessão da própria comanda, sem vazar dados de outras comandas.

## Revisão obrigatória

Antes da implementação, documente no `docs/sprint-03.md` respostas confirmadas, contratos HTTP, permissões, entidade/campos, transações, erros e cenários de teste. Atualize este perfil e os `AGENTS.md` dos módulos quando o escopo fechar. Preserve migrations aplicadas, Sprint 1/2 e os padrões de `npm run check`.
