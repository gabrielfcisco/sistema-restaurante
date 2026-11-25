# Administração — Grupo 9

**Estado em 25/11/2026:** US-20/22/23/24/25/26 implementadas. O estado e contratos finais ao fim de `docs/sprint-04.md` (na raiz) prevalecem sobre as notas históricas de preparação abaixo. Preservar as regras e restrições de escopo.

Workspace Electron/React existente. US-19 implementada: categorias persistidas via GET/POST/PATCH `/administracao/categorias`. Preservar formulários, tratamento de falhas, nome único e inativação refletida no cardápio. `Produto.categoria` é FK textual, não enum. Acesso sem login, somente na rede interna; `VITE_API_URL` configura a API.

Sprint 4: US-20 (setor responsável) e US-26 (cadastro de produtos) usam este mesmo app, a navegação Produtos e um formulário compartilhado. Leia `../../AGENTS.md` e `../../docs/sprint-04.md`. Implementar somente a história solicitada e coordenar contratos com a outra história; não criar outro app de produtos. Lista de gestão pode incluir inativos; catálogo do cliente não serve como substituto.

Consulte `screenshots/` e os nós Figma registrados no documento da sprint antes de construir telas. A captura de categorias não define automaticamente a tela de produtos. Não inventar referências ou sucesso de gravação. Validar no backend e só confirmar após resposta real. Bloquear alteração de setor enquanto houver itens não entregues em atendimentos ativos; proteger contra confirmação concorrente de pedidos. A navegação Produtos contém uma prévia autorizada em `src/Produtos.tsx`.

Não importar Prisma, Node, segredos ou internals de outros apps. Reutilizar `ui`, `api-client` e `contracts`; manter Electron isolado. Edição de preços/disponibilidade de produtos existentes (US-27), upload e relatórios não estão autorizados por este escopo.
