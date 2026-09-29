# Ambiente de desenvolvimento

## Instalação

1. Instalar Node 24 LTS e conferir `node --version`/`npm --version`. `.nvmrc` e `.node-version` registram a versão principal.
2. Na raiz do repositório, rodar `npm ci` e `npm run setup`.
3. Configurar `apps/api/.env` para MySQL de desenvolvimento.
4. Rodar `npm run db:deploy` e, opcionalmente, `npm run db:seed`.
5. Rodar `npm run dev`.

O `postinstall` gera o Prisma Client, sem precisar conectar ao banco. Não use `--ignore-scripts` na instalação normal: Electron também precisa baixar seu executável. Instalação requer internet; builds e execução local usam as dependências já instaladas.

## Portas

| Serviço | Porta | Uso |
|---|---|---|
| API | 3333 | Compartilhado entre apps |
| Vite recepção | 5173 | Somente desenvolvimento |
| Vite mesa | 5174 | Somente desenvolvimento |
| MySQL | 3306 | Somente backend |

As portas Vite são estritas: se ocupadas, o comando falha em vez de abrir outro app na porta errada. Fechar uma janela encerra seu processo de desenvolvimento; `npm run dev` encerra o conjunto para não deixar serviços órfãos. Para manter apps independentes, iniciar pelos comandos separados.

## Dois PCs na rede local

No computador servidor, configurar `HOST=0.0.0.0` em `apps/api/.env` e permitir a porta da API na rede privada. No outro computador, configurar `VITE_API_URL=http://IP_DO_SERVIDOR:3333/api` no `.env` de cada app. `localhost` em cada PC aponta para ele próprio.

Reiniciar desenvolvimento após alterar env. Para usar a interface compilada ou empacotada, executar build/package novamente: variáveis `VITE_*` são incorporadas no build, não são segredos e não são lidas dinamicamente pelo executável. Para distribuição futura, substituir por configuração de servidor em runtime.

A API aceita as origens Vite configuradas em `CORS_ORIGINS` e a origem opaca dos apps `file://`. CORS não autentica clientes; as rotas de negócio deverão exigir autorização adequada. Usar esta base apenas em desenvolvimento, com dados fictícios.

## Verificações

- `npm run check` funciona sem banco acessível: tests usam probes controladas; `prisma validate` valida o schema, não a conexão.
- `/api/ready` só retorna sucesso com MySQL acessível e credenciais corretas.
- Usar as telas iniciais para verificar conexão de cada janela à API.
- Para repetir o teste automatizado das interfaces compiladas, iniciar a API com `npm run dev:api` e executar `npm run build` e `npm run test:desktop` em outro terminal. Esse teste abre janelas ocultas, verifica renderização/conexão e encerra as janelas. Ele usa a URL incorporada no build.
- Após iniciar a implementação, testar fluxo integrado e restrições no banco, além dos testes unitários.

Não versionar `.env`, `node_modules`, cliente gerado, `dist` ou `release`. Preservar `package-lock.json` e usar `npm ci` nos outros computadores.

## Avisos de dependências

Na preparação, `npm audit` reportou 7 avisos (1 baixo, 1 moderado, 5 altos), envolvendo a árvore do Prisma/MariaDB e ferramentas de compilação. `npm audit fix` não os resolveu dentro das faixas atuais. Não foi aplicado `--force`, que propôs retroceder o Prisma para outra versão principal. A migração de dependências deve ser revisada e testada, inclusive com MySQL real, antes de produção. `npm run check` não inclui nem substitui essa auditoria. A base foi validada para desenvolvimento, sem credenciais reais e sem autenticação de produção.
