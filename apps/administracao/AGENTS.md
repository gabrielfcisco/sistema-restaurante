# Administração — preparação Sprint 3 (Grupo 9)

**US-19 implementada:** GET/POST/PATCH reais em `/administracao/categorias`. Formulários validam e preservam entradas em falha; nome/status só mudam após resposta da API. O banco usa Categoria com ID textual estável; inativação preserva produtos/histórico. `VITE_API_URL` configura a API do build, com localhost como padrão. Não implementar produtos/relatórios. A descrição de prévia abaixo é histórica.

Este é um workspace desktop Electron com prévia visual da US-19 (categorias). Ainda não consome a API e não persiste alterações. Leia `../../AGENTS.md` e `../../docs/sprint-03.md` antes de alterar o app.

Decisões confirmadas: sem login, somente na rede interna; categorias dinâmicas persistidas, iniciando pelas categorias existentes `PRATO`, `SOBREMESA` e `BEBIDA`; inativar uma categoria oculta seus produtos sem apagá-los; nomes obrigatórios, aparados e únicos sem diferenciar maiúsculas/minúsculas. O schema atual usa enum em `Produto.categoria`; planejar migration e compatibilidade aditivas antes de qualquer CRUD. O protótipo exibe categorias ilustrativas e informa que ações não são salvas. Não acessar Prisma diretamente pelo frontend.

Consulte `screenshots/` e as referências Figma disponíveis antes de implementar interface. Pasta sem capturas significa que ainda não há referência visual versionada; não inventar telas.
