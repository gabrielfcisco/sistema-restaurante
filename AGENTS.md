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

Os critérios fornecidos estão consolidados em `docs/sprint-02.md`. A sprint está preparada, não implementada: não adicione handlers, telas funcionais, upload nem migrations nesta etapa. Ao implementar uma história autorizada, use os critérios e as pendências do documento.

- `apps/mesa`: cardápio, detalhe, montagem, revisão e confirmação de pedido (US-07–11), consumindo a API compartilhada e a sessão de comanda já existente.
- `apps/cozinha`: workspace Electron/Vite preparado com tela inicial placeholder; o painel em tempo real de itens de comida é US-12 e ainda não está implementado. Por decisão do Grupo 9, o painel não exige login e ficará na rede interna.
- `apps/bar`: workspace Electron/Vite preparado com tela inicial placeholder; o painel em tempo real de bebidas/itens do setor bar é US-13 e ainda não está implementado. Por decisão do Grupo 9, o painel não exige login e ficará na rede interna.
- `apps/recepcao`: preservar fluxos Sprint 1; as histórias fornecidas não justificam mudanças nele.
- `apps/api`: fonte única para catálogo, disponibilidade, validação de quantidade, criação transacional e filas por setor. As rotas candidatas e permissões em aberto estão em `docs/sprint-02.md` e `docs/contratos-api.md`.
- Produto, categoria, setor, pedido e item já existem no Prisma; verifique as decisões/gaps em `docs/sprint-02.md` antes de propor migration. `Produto.ativo` controla aparição no cardápio; pedido e itens iniciam em `RECEBIDO`, exigindo compatibilidade de schema.
- Consulte e preserve as capturas de `apps/{mesa,recepcao,cozinha,bar}/screenshots/`. Pastas vazias significam ausência de referência versionada; não invente imagens ou telas.
- Imagem de teste deve ser versionada em `assets/cardapio/` e referenciada no banco por caminho relativo estável. Nunca persistir bytes/base64 nem caminho absoluto; a URL deve ser servida pela API na rede interna. Imagens de produção/gestão são futuras.

## Rotas, persistência e validação

Rotas atuais vivem em `apps/api/src/modules/*/routes.ts` e são montadas em `sprint-routes.ts`; handlers devem ser finos e delegar regras/transações ao serviço. As rotas Sprint 2 estão documentadas como contratos planejados, não existem no servidor. Os painéis operacionais não exigem login por decisão do Grupo 9; confirme o limite de rede do deploy. Resolva as demais pendências registradas sem reabrir decisões já confirmadas. Confirmação do pedido deve gravar cabeçalho e todos os itens atomicamente e associar à comanda ativa validada no servidor.

Use `npm run check` na raiz após mudanças relevantes, quando o ambiente permitir. Não aplicar migration em banco desconhecido nem usar dados pessoais reais. Registre falhas ambientais separadas de falhas de código.

## Agente especializado de rotas Sprint 2

O perfil operacional `api-sprint2-routes` está em `.agents/agents/api-sprint2-routes.md`. Use suas instruções ao delegar a implementação das rotas de US-07–13. Ele deve implementar apenas contratos confirmados, preservar este arquivo e `docs/sprint-02.md`, e parar para registrar decisão quando uma pendência exigir definição do Grupo 9; não inventar autenticação, semântica de status ou migração.
