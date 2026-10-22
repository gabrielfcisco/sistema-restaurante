# Sistema de restaurante — Grupo 9

Monorepo com API Node/Express e aplicativos React/Electron separados. Sprint 2: os painéis da cozinha (US-12) e do bar (US-13) estão implementados sobre a base da Sprint 1. Mesa, recepção, cozinha e bar compartilham a mesma API e o banco MySQL.

## Começar

Pré-requisitos: **Node 24 LTS**, npm 10 ou superior; MySQL 8 para trabalhar com persistência. O Node 20.17 encontrado nesta máquina é antigo para esta base. Confira `node --version` antes de instalar. Não há instalação global de Electron ou Prisma.

Na pasta `sistema-restaurante`:

```sh
npm ci
npm run setup
npm run setup:sprint
npm run dev
```

`setup` copia os exemplos de ambiente sem sobrescrever arquivos existentes. `setup:sprint` provisiona credenciais locais da recepção e da mesa 1, fora da interface React. Configure o banco e aplique as migrations em um banco de desenvolvimento conhecido antes de usar os atendimentos. `dev` inicia a API e as quatro janelas Electron. Cozinha e bar consultam suas filas sem login e atualizam por SSE; confira [execução, migration e testes das US-12/13](docs/us-12-us-13.md).

Ao trocar de branch ou receber alterações de dependências, execute `npm ci` novamente na raiz `sistema-restaurante`. Isso atualiza os vínculos dos pacotes internos, incluindo `@restaurante/desktop`. A inicialização verifica a versão do Node e esse pacote antes de abrir as janelas.

Para executar separadamente, use um terminal para cada comando:

```sh
npm run dev:api
npm run dev:recepcao
npm run dev:mesa
npm run dev:cozinha
npm run dev:bar
```

## API da sprint 1

A API do Felipe está integrada às telas de cadastro/busca, abertura, mapa e gerenciamento de mesas, identificação por QR/código e saída da sessão. Veja [contratos da API](docs/contratos-api.md) e [configuração e demonstração das interfaces](docs/interfaces.md). GET /acessos/mesa revalida o acesso temporário. Configure RECEPCAO_API_TOKEN e MESA_DEVICE_TOKENS em apps/api/.env e provisione as credenciais desktop. Gere o cliente com `npm run db:generate` e aplique migrations somente após conferir o banco de destino.

## Banco

Crie um banco **de desenvolvimento** chamado `gerenciamento_restaurante` e configure `DATABASE_URL` em `apps/api/.env`. Credenciais não são incluídas nos frontends.

```sh
npm run db:deploy
npm run db:seed
```

`db:deploy` aplica migrations pendentes; não execute contra um banco desconhecido. O seed cria seis mesas se faltarem e preserva as existentes. Não cria cartões ou clientes: a nova modelagem de cartões e os cadastros pertencem à sprint. Bancos que já aplicaram a migration inicial mantêm o mesmo histórico, agora em `apps/api/prisma`.

`GET http://127.0.0.1:3333/api/health` verifica o processo. `GET /api/ready` consulta o banco e retorna 503 quando indisponível. Não confundir servidor iniciado com banco conectado.

## Comandos

| Comando | Objetivo |
|---|---|
| `npm run check` | Lint, tipos, testes, builds e validação do schema |
| `npm run build` | Gera API em `dist` e interfaces em `dist` de cada app |
| `npm start -w @restaurante/api` | Inicia API compilada |
| `npm start -w @restaurante/recepcao` | Abre interface compilada no Electron |
| `npm start -w @restaurante/mesa` | Abre interface compilada no Electron |
| `npm run package:recepcao` | Gera pasta executável desktop da recepção |
| `npm run package:mesa` | Gera pasta executável desktop da mesa |
| `npm run package:cozinha` | Gera pasta executável desktop da cozinha |
| `npm run package:bar` | Gera pasta executável desktop do bar |
| `npm run db:generate` | Gera cliente Prisma após mudança de schema |
| `npm run db:migrate` | Cria/aplica migration em banco de desenvolvimento |
| `npm run db:studio` | Abre inspeção local do banco |

Os comandos `package:*` geram distribuição em pasta (`release/`), ainda sem instalador assinado. O backend é executado separadamente e não é embutido nos aplicativos.

## Organização e continuidade

- [Arquitetura e expansão](docs/arquitetura.md)
- [US-12 e US-13: cozinha e bar](docs/us-12-us-13.md)
- [Interfaces, configuração desktop e demonstração da sprint](docs/interfaces.md)
- [Ambiente e dois computadores](docs/ambiente.md)
- [Sprint 01 e divisão entre cinco integrantes](docs/sprint-01.md)
- [Contratos da API](docs/contratos-api.md)
- [Modelagem e migration da sprint](docs/banco.md)

`apps/api` contém o backend único. `apps/cozinha` e `apps/bar` reutilizam o painel operacional de `packages/ui`, com filas e alterações separadas por setor no servidor. `packages/api-client` e `packages/contracts` também são compartilhados. `legacy/nextjs` preserva o scaffold anterior e não é executado.

Próximos apps: garçom, caixa e administração. Serão criados em `apps/` quando entrarem nas sprints. Não existem endpoints fictícios retornando sucesso para funcionalidades ainda não implementadas.
