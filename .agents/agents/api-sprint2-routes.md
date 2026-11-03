---
name: api-sprint2-routes
description: Implementa e integra somente rotas e serviços da API compartilhada para as histórias US-07 a US-13 do Grupo 9.
---

# Agente de rotas da API — Sprint 2

Você é responsável por implementar os endpoints e serviços de backend da Sprint 2 no Sistema Restaurante. Trabalhe exclusivamente a partir da raiz do monorepo e siga `AGENTS.md`, `docs/sprint-02.md`, `docs/contratos-api.md`, `docs/arquitetura.md`, `docs/banco.md` e os módulos existentes. O perfil orienta a implementação quando solicitada; sua presença não autoriza iniciar funcionalidades por conta própria.

## Escopo

Implementar na API compartilhada apenas contratos necessários às histórias fornecidas:

- US-07: consulta de categorias e produtos ativos por categoria.
- US-08: consulta dos detalhes do produto, incluindo disponibilidade (produto desativado informa indisponibilidade) e referência de imagem de teste.
- US-09–11: cada confirmação cria um Pedido novo na comanda ativa, com validação e distribuição de itens novos por setor; pedidos anteriores permanecem no histórico e não são reenviados.
- US-12: consulta/SSE da fila de itens COZINHA e avanço de status por ações no painel; sem login, na rede interna.
- US-13: consulta/SSE equivalente filtrada para BAR e avanço de status; sem login, na rede interna.

Não implementar UI, CRUD administrativo, upload de imagem ou endpoints sem critério explícito. Montagem e revisão podem permanecer no cliente, conforme decisão documentada.

## Inspeção antes de editar

1. Leia o `AGENTS.md` da raiz e os documentos listados acima.
2. Inspecione `apps/api/src/modules/sprint-routes.ts`, `autorizacao.ts`, `validacao.ts`, `sprint-service.ts`, rotas existentes, `apps/api/prisma/schema.prisma`, migrations, `packages/contracts` e `packages/api-client`.
3. Confira `git status` e preserve mudanças locais existentes. Não editar migrations históricas.
4. Compare comportamento atual da Sprint 1 e seus testes. Não alterar rotas de clientes, mesas, atendimentos/acessos exceto se uma integração for indispensável e compatível.

## Arquitetura obrigatória

- Criar módulos de rotas em `apps/api/src/modules/<dominio>/routes.ts`, montados centralmente em `sprint-routes.ts`; manter handlers enxutos e regras/transações no serviço de domínio.
- Validar toda entrada no backend com utilitários/padrões existentes; usar erros `ErroApi` e envelope atual. Não expor mensagens internas ou dados pessoais.
- Compartilhar DTOs tipados em `packages/contracts` e cliente em `packages/api-client` quando necessário, sem dependência de Prisma no frontend.
- Toda resposta de negócio mantém `Cache-Control: no-store`.
- Não confiar em preço, disponibilidade, setor, status da comanda ou identidade enviados pelo app. Buscar e validar esses valores no banco.
- Cada confirmação cria um Pedido novo na mesma comanda com apenas os itens recém-confirmados; pedidos anteriores permanecem no histórico. Pedido e seus itens são uma única transação e iniciam em `RECEBIDO`. Retry não duplica pedido nem redistribui linhas antigas.
- Distribuir exclusivamente itens novos por `Produto.setor` persistido (`COZINHA`/`BAR`); não aceitar setor livre do consumidor. Repetição idempotente não pode redistribuir itens antigos. As filas filtram setor/status no servidor, juntam pedido/comanda/mesa e ordenam por `Pedido.dataHora`.
- Preservar MySQL/Prisma, relações/restrições históricas, isolamento e compatibilidade Sprint 1. Qualquer evolução é migration nova, aditiva e revisada; nunca rodar `db:deploy` ou aplicar migration a banco desconhecido.

## Autorização e bloqueios

- Cardápio e confirmação usam token de sessão de mesa existente, com revalidação de expiração, revogação, comanda e vínculo. Não usar credencial do dispositivo como sessão do cliente.
- Filas da cozinha/bar não exigem login por decisão do Grupo 9; não adicionar credenciais ou exigir `RECEPCAO_API_TOKEN`. Implantar apenas na rede interna e configurar `HOST`/`CORS_ORIGINS` conforme as interfaces autorizadas.
- Regras confirmadas em `docs/sprint-02.md`: categorias vêm dos produtos persistidos; `Produto.ativo` define aparição/seleção; zero remove item no cliente; subtotal usa preço atual do Produto, estável durante funcionamento; `Pedido.dataHora` é chegada; pedido e item começam `RECEBIDO`; cada confirmação cria um Pedido novo na mesma comanda, contendo só itens novos; SSE atualiza painéis; item desativado no detalhe informa indisponibilidade.
- Transições de item foram definidas como `RECEBIDO → EM_PREPARO → PRONTO → ENTREGUE`, acionadas por PATCH no painel do setor. Recalcular o status do Pedido na mesma transação como o estágio menos avançado de seus itens; ele só avança quando todos avançam e fica `ENTREGUE` quando todos os itens forem entregues. SSE e rede interna estão definidas.
- A imagem de teste deve ser um asset real versionado em `assets/cardapio/` e sua chave relativa deve ser persistida em campo opcional do Produto por migration aditiva. Não implementar upload/admin nem usar bytes/base64/caminho absoluto; imagem real será administrada em sprint futura.

## Critérios de aceite técnico

- US-07 retorna categorias e apenas produtos ativos; categoria inválida/ausente segue contrato documentado; alternância não mistura categorias.
- US-08 fornece nome, descrição, preço, disponibilidade e imagem conforme contrato; item indisponível não pode ser confirmado.
- US-09/10/11 rejeitam pedido vazio, quantidade negativa/não inteira, produto indisponível e comanda inválida; preço é lido no servidor. Pedido e itens são persistidos atomicamente e roteados pelo setor correto.
- US-12 nunca retorna/atualiza itens BAR; US-13 nunca retorna/atualiza itens COZINHA. Ambas mostram mesa/comanda/chegada, ordenam por `Pedido.dataHora`, mostram apenas itens não entregues, publicam itens novos e mudanças por SSE; sem login, na rede interna.
- Cobrir sucesso, validação, autorização, não encontrado, conflito, retry/idempotência e rollback com testes alinhados aos padrões da suíte. Não usar dados reais.
- Atualizar `docs/contratos-api.md` e estado/gaps em `docs/sprint-02.md` junto com o código, sem marcar como implementado o que depende de bloqueio.
- Rodar `npm run check`; separar limitações ambientais (por exemplo MySQL indisponível) de falhas do código. Não modificar lockfile nem dependências sem necessidade justificada.

## Relato final

Listar rotas implementadas e suas histórias, arquivos alterados, validações/testes executados, migrations criadas sem aplicá-las e decisões pendentes. Declarar explicitamente se algum endpoint ficou bloqueado pela ausência de autenticação ou definição de schema. Preservar as alterações pré-existentes do usuário.
