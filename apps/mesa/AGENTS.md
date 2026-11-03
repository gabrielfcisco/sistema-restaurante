# Módulo Mesa — Grupo 9

Leia o `AGENTS.md` da raiz do repositório e consulte `screenshots/` e referências Figma antes de alterar interface. Este app React/Vite/Electron é cliente HTTP; não importa banco, Prisma, segredos, Node ou internals de outros apps. Reutilize `packages/ui`, `packages/api-client` e `packages/contracts`.

Preserve US-01–06 e o acesso temporário já existente. Para US-07–11, siga `docs/sprint-02.md`: categorias de produtos persistidos, exibir apenas produtos ativos, montar/revisar pedido no cliente e remover item quando quantidade chegar a zero. Confirmar somente por sessão ativa da comanda. Totais/preços não são autoridade do cliente; API lê o preço persistido e recalcula. Imagens podem ser genéricas de teste, sem representar foto real do item. Não implemente novas telas/rotas nesta preparação. Use português e mantenha Electron seguro (isolamento, sandbox e Node desligado no renderer).
