# Desenvolvimento — Sistema Restaurante (Grupo 9)

Monorepo npm com Node/Express, TypeScript, React/Vite, Electron, MySQL/Prisma e pacotes compartilhados. Estas instruções são autocontidas para um clone. Leia `README.md`, `docs/arquitetura.md`, `docs/banco.md`, `docs/contratos-api.md`, `docs/sprint-01.md`, `docs/sprint-02.md` e a história pertinente antes de alterar código. Consulte `apps/<modulo>/screenshots/` e as referências Figma acessíveis antes de implementar interface. `legacy/nextjs` é histórico e não deve receber desenvolvimento.

## Convenções do repositório

- Apps ficam em `apps/`; a API e as regras de negócio compartilhadas em `apps/api`; contratos em `packages/contracts`; cliente HTTP em `packages/api-client`; componentes compartilhados em `packages/ui`.
- Apps React não acessam Prisma, banco, segredos, Node ou Electron. Nenhum app importa internals de outro. Os módulos cliente dependem de `ui`, `api-client` e `contracts`.
- Mantenha português nas interfaces e mensagens. Reutilize validação, autorização, erros e transações do backend; não duplique regras nos apps.
- Electron mantém `contextIsolation`, sandbox e `nodeIntegration: false`; integrações de dispositivo ficam em adapters próprios.
- Preserve Sprint 1: uma mesa pode ter várias comandas ativas, um cartão só uma; novo cliente exige nome, CPF e telefone; mantenha sessões, idempotência, histórico e compatibilidade. Não altere migrations aplicadas; mudanças de banco são incrementais e não devem ser aplicadas em banco desconhecido.
- Segredos nunca ficam em código, frontend, contratos ou logs. Autorização deve ser verificada pela API; estar em um app específico não concede acesso.
- Não altere tecnologias, dependências, lockfile ou código funcional sem necessidade demonstrada. Não crie respostas de sucesso fictícias.

## Sprint 2 — US-07 a US-13 (Grupo 9)

A Sprint 2 está implementada; contratos finais, migrações e verificações das telas de cozinha/bar estão em `docs/us-12-us-13.md`, `docs/sprint-02.md` e `docs/contratos-api.md`. Preserve esses comportamentos ao trabalhar na Sprint 3.

- `apps/mesa`: cardápio, detalhe, montagem, revisão e confirmação de pedido (US-07–11), consumindo a API compartilhada e a sessão de comanda já existente.
- `apps/cozinha` e `apps/bar`: apps operacionais Electron/Vite implementados, usando API comum, SSE e PATCH por setor; consulte `docs/us-12-us-13.md`. Por decisão do Grupo 9, os painéis não exigem login e ficam na rede interna.
- `apps/recepcao`: preservar fluxos Sprint 1; as histórias fornecidas não justificam mudanças nele.
- `apps/api`: fonte única para catálogo, confirmação transacional de pedidos, status e filas por setor. Os contratos existentes estão em `docs/contratos-api.md`.
- Produto, categoria, setor, pedido e item já existem no Prisma; verifique as decisões/gaps em `docs/sprint-02.md` antes de propor migration. `Produto.ativo` controla aparição no cardápio; pedido e itens iniciam em `RECEBIDO`, exigindo compatibilidade de schema.
- Consulte e preserve as capturas de `apps/{mesa,recepcao,cozinha,bar}/screenshots/`. Pastas vazias significam ausência de referência versionada; não invente imagens ou telas.
- Imagem de teste deve ser versionada em `assets/cardapio/` e referenciada no banco por caminho relativo estável. Nunca persistir bytes/base64 nem caminho absoluto; a URL deve ser servida pela API na rede interna. Imagens de produção/gestão são futuras.

## Sprint 3 — US-14 a US-19 e US-21 (Grupo 9)

**Estado atual:** US-14/15/16/17/18/19/21 integradas. Consulte os contratos finais e testes em `docs/sprint-03.md`. Preserve o feed conjunto de chamados e retirada e o feed autenticado da mesa.

As decisões e contratos estão em `docs/sprint-03.md` e `docs/contratos-api.md`. Reutilize o serviço operacional para transições e não duplique suas regras nos aplicativos.

US-18 e US-21 foram implementadas em API, contratos, cliente e telas da mesa/garçom; as demais histórias da Sprint 3 não estão implementadas. Ao receber uma história, leia seus critérios oficiais e a documentação indicada, confira o código/schema/rotas existentes e as referências de tela; implemente somente o escopo solicitado. As rotas não marcadas como implementadas em `docs/sprint-03.md` continuam propostas. Não confie apenas nesta documentação: valide cada contrato contra o estado atual do código e registre qualquer divergência ou decisão em aberto antes de assumi-la.

- Módulos: cozinha/bar (US-14), garçom (US-15/17/18), mesa (US-16/18/21), administração (US-19). Todos usam a API comum.
- A mesa pode ter várias comandas ativas; na US-17 o garçom lista todas e seleciona uma.
- `Produto.categoria` é enum hoje; a US-19 migra para categorias persistidas e precisa preservar o catálogo existente.
- `ItemPedido` não guarda preço histórico; preserve a regra confirmada de preço estável, e não invente snapshot sem decisão.
- Referências visuais: consultar `apps/<modulo>/screenshots/` e Figma quando acessível. Não inventar capturas ou telas.
- Acessos sem login só podem ser usados se confirmados e com o limite de rede registrado; não tratar localização do app como autorização.

## Rotas, persistência e validação

Rotas atuais vivem em `apps/api/src/modules/*/routes.ts` e são montadas em `apps/api/src/modules/sprint-routes.ts`; handlers devem ser finos e delegar regras/transações ao serviço. US-18 e US-21 já estão implementadas; as outras rotas candidatas da Sprint 3 estão em `docs/sprint-03.md`. Os painéis existentes e as novas rotas de garçom/administração foram definidos sem login, somente na rede interna, conforme decisão do Grupo 9.

Use `npm run check` na raiz após mudanças relevantes, quando o ambiente permitir. Não aplicar migration em banco desconhecido nem usar dados pessoais reais. Registre falhas ambientais separadas de falhas de código.

## Perfis de agentes

O perfil histórico de rotas Sprint 2 está em `.agents/agents/api-sprint2-routes.md`. O perfil para preparação/rotas Sprint 3 está em `.agents/agents/api-sprint3.md`; siga os contratos candidatos de `docs/sprint-03.md` e não implemente sem solicitação explícita.
