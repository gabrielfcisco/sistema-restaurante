# Sprint 3 — Preparação das US-14 a US-19 e US-21 (Grupo 9)

## Escopo e estado

Este documento consolida as histórias e tarefas técnicas da planilha `cartoes_UNICA_PLANILHA_DUPLEX.xlsx` e as decisões confirmadas pelo Grupo 9. Esta etapa prepara o repositório; não implementa as funcionalidades.

| História | Pontos | Módulos envolvidos | Critérios oficiais resumidos | Entidades/integrações a avaliar |
|---|---:|---|---|---|
| US-14 | 8 | `apps/cozinha`, `apps/bar`, API | Funcionário avança item recebido → em preparo → pronto; bloquear transições inválidas; refletir mudança para garçom e cliente. | `ItemPedido`, `Pedido`, eventos SSE/estado dos painéis. Reutilizar PATCH existente; cozinha/bar param em PRONTO. |
| US-15 | 5 | Novo `apps/garcom`, API | Garçom vê itens prontos com mesa e comanda, marca item como entregue e ele sai da lista de retirada. | `ItemPedido`, `Pedido`, `Comanda`, `Mesa`; endpoint de fila de retirada e transição `PRONTO → ENTREGUE`. |
| US-16 | 8 | `apps/mesa`, API | Cliente vê status de cada item; atualização reflete mudanças de cozinha/bar; itens entregues continuam visíveis; não vê outra comanda. | Sessão `SessaoMesa`, `Comanda`, `Pedido`, `ItemPedido`; snapshot e SSE autenticado e limitado à comanda da sessão. |
| US-17 | 5 | Novo `apps/garcom`, API | Garçom busca pela mesa, vê todas as comandas ativas e seleciona uma; consulta pedidos/status e total parcial; tratar mesa sem comanda. | `Mesa`, múltiplas `Comanda`, `Pedido`, `ItemPedido`, `Produto`; consulta agregada e cálculo compartilhado com US-21. |
| US-18 | 5 | `apps/mesa`, novo `apps/garcom`, API | Cliente aciona chamada vinculada à mesa; equipe vê chamada pendente e consegue concluí-la. Um segundo acionamento enquanto existir uma pendente retorna a mesma chamada, sem duplicar. | Sessão e mesa; persistência de chamadas e atualização do painel. O schema não tem entidade de chamada. |
| US-19 | 13 | Novo `apps/administracao`, API | Gerente cria, edita nome/status e inativa categorias; categorias ativas aparecem no cardápio; inativar uma categoria oculta seus produtos. Categorias iniciais espelham `PRATO`, `SOBREMESA`, `BEBIDA`. | `Produto.categoria` hoje é enum `CategoriaProduto`; migrar para entidade relacional `Categoria` e preservar produtos existentes. |
| US-21 | 5 | `apps/mesa`, API | Cliente consulta extrato da comanda com itens, quantidades, valores unitários e total; somar todos os pedidos confirmados, mesmo em preparo; somente comanda da sessão. | `SessaoMesa`, `Comanda`, `Pedido`, `ItemPedido`, `Produto`; preço do Produto e cálculo monetário. |

Total: **49 pontos**, conforme a planilha. Os detalhes e tarefas técnicas estão registrados na fonte; os resumos acima não substituem a consulta aos critérios oficiais durante a implementação.

## Prontidão para implementação por IA ou desenvolvedor

O repositório contém contexto e decisões suficientes para iniciar qualquer uma das histórias desta sprint, mas a preparação não implementou seus fluxos. Garçom e Administração possuem somente prévias visuais; contratos HTTP abaixo são candidatos documentados, não rotas funcionais. Antes de codificar, consulte os critérios oficiais da história solicitada, `AGENTS.md`, esta documentação, os `AGENTS.md` dos módulos, as capturas em `screenshots/` e o código atual de rotas, serviços, entidades, contratos e clientes. Não presuma que uma rota descrita aqui já existe.

Implemente somente as histórias solicitadas. Quando a história atravessar camadas, complete o percurso necessário: regra de negócio na API, DTO/contrato compartilhado, cliente HTTP e tela do módulo, preservando autorização, transações, atualização de status e compatibilidade com Sprint 1/2. Verifique os fluxos e testes relacionados; não marque uma história pronta só porque a tela visual já existe. Se o código atual divergir das propostas deste documento ou faltar uma decisão de negócio, descreva a divergência/pendência e não invente comportamento.

### Exemplo de início: US-16

Uma solicitação para implementar a US-16 deve levar a IA a trabalhar em `apps/api`, `packages/contracts`, `packages/api-client` e `apps/mesa`, conforme a arquitetura existente. A história exige que o cliente veja status de todos os itens da própria comanda, inclusive os entregues; a API deve validar o bearer da sessão e o vínculo atual com a comanda. O cliente abre com um snapshot e recebe mudanças de status por SSE autenticado, escopado à comanda; reconexão recupera o snapshot. Não usar polling a cada cinco segundos, token em query string, nem expor dados de outra comanda. Reutilizar eventos/publicação já existentes quando possível. Validar a atualização emitida após as transições cozinha/bar e entrega do garçom, sem duplicar regra de status no frontend. A rota candidata está na tabela de contratos; conferir a montagem e padrões reais da API antes de implementá-la. A história não deve incluir o extrato US-21 nem outras histórias, salvo dependência técnica justificada e documentada.

## Arquitetura existente relevante

- O backend compartilhado está em `apps/api`; rotas são montadas em `apps/api/src/modules/sprint-routes.ts`, regras e transações ficam em serviços, e DTOs/cliente ficam em `packages/contracts` e `packages/api-client`.
- `apps/garcom` agora tem web app/PWA responsiva e `apps/administracao` tem shell Electron desktop. São prévias visuais sem integração à API; a query `?preview=1` no garçom mostra dados ilustrativos. As ações da administração apenas informam que API não conectada e não salvam mudanças.
- Os painéis de cozinha/bar já usam `GET /api/{cozinha,bar}/itens`, SSE e `PATCH /api/{cozinha,bar}/itens/:idItem/status`. Para esta sprint, esses apps permitem somente `RECEBIDO → EM_PREPARO → PRONTO`; o app garçom fará `PRONTO → ENTREGUE` para itens dos dois setores.
- O app mesa já possui sessão de comanda e acompanha fluxos de catálogo/pedido. US-16/21 devem validar sempre que a comanda consultada corresponde à sessão ativa.
- O modelo permite várias comandas ativas em uma mesa. O garçom apresenta todas e seleciona a comanda a consultar.
- Garçom e gerente operarão sem login, somente na rede interna. Não existe autenticação individual de funcionários, entidade de chamadas de garçom ou entidade relacional de categoria.
- O `Produto.categoria` atual é enum (`PRATO`, `SOBREMESA`, `BEBIDA`); a US-19 foi confirmada para migrar categorias dinâmicas e iniciar com essas três categorias.
- `ItemPedido` armazena quantidade e status, mas não preço unitário histórico. Reutilizar `Produto.preco` mantém a decisão da Sprint 2 de preço estável durante o funcionamento; qualquer mudança dessa regra exigirá decisão explícita e migration aditiva.

## Regras confirmadas pelo Grupo 9

- **Acesso de equipe:** garçom e administração sem login, somente na rede interna. A API não cria perfis/autenticação nesta sprint; limitar exposição da API às origens/rede autorizadas conforme configuração existente.
- **Status/entrega:** cozinha e bar avançam somente `RECEBIDO → EM_PREPARO → PRONTO`. O garçom marca `PRONTO → ENTREGUE` para qualquer item dos dois setores. Itens entregues saem da retirada e das filas operacionais, mas continuam no histórico/acompanhar cliente/extrato. Status geral do Pedido segue a regra já confirmada: estágio menos avançado de todos os itens, recalculado na mesma transação.
- **Consulta de mesa:** garçom lista todas as comandas ativas da mesa e seleciona uma. Mesa sem comandas ativas retorna lista vazia/estado apropriado.
- **Chamadas:** no máximo uma chamada pendente por mesa. Repetir acionamento durante pendência não cria registro novo e retorna a chamada existente. O garçom conclui a chamada ao atender.
- **Categorias:** migrar de enum para categorias persistidas, iniciando com as três categorias atuais (`PRATO`, `SOBREMESA`, `BEBIDA`). Inativar categoria oculta os produtos associados no cardápio, sem apagar produtos, pedidos ou históricos. A API também deve impedir confirmação de item selecionado antes da inativação quando sua categoria estiver inativa.
- **Nome de categoria:** obrigatório, aparado nas extremidades e único sem diferenciar maiúsculas/minúsculas. A verificação deve ser aplicada também ao editar e protegida no banco com chave/índice compatível com a collation escolhida.
- **Liberação de mesa:** se houver chamada pendente, cancelar automaticamente na mesma transação que libera/encerra as comandas da mesa, para não deixar alerta órfão. Preservar registro da chamada no histórico.
- **Atualização US-16:** usar SSE autenticado e escopado à comanda da sessão. É uma conexão persistente que transmite mudanças, evitando requisições periódicas a cada cinco segundos. Fazer GET de snapshot ao abrir/reconectar; publicar eventos ao atualizar status pela API. Preferir feed orientado a eventos para esse escopo, sem polling por cliente.
- **Extrato/total:** somar todos os itens persistidos de pedidos confirmados da comanda, em qualquer status de preparo; rascunhos que não foram confirmados não existem no banco e não entram. Usar quantidade × preço persistido do Produto, conforme regra de preço estável confirmada anteriormente.

Permanecem válidas decisões da Sprint 2: sessão de mesa validada pelo backend; cada confirmação cria pedido novo; preço não muda durante operação; cozinha/bar usam SSE; imagens/assets e administração de produtos não fazem parte dessas histórias.

## Preparação de rotas e persistência

## Contratos HTTP planejados

Todos são propostas de preparação e ainda não estão implementados. Prefixo `/api`. Rotas de cozinha/bar existentes devem ser ajustadas para terminar em PRONTO; nenhuma nova rota de US-14 é necessária.

| História | Método e rota candidata | Acesso | Contrato resumido |
|---|---|---|---|
| US-14 | PATCH `/cozinha/itens/:idItem/status`, PATCH `/bar/itens/:idItem/status` (existentes) | Sem login, rede interna | Transições do setor somente até `PRONTO`; refletir via SSE para filas, retirada e cliente. Rejeitar `ENTREGUE` nestas rotas após a mudança. |
| US-15 | GET `/garcom/itens-prontos` | Sem login, rede interna | Itens `PRONTO` dos dois setores, com item, mesa, comanda e horário; ordenados por chegada. |
| US-15 | PATCH `/garcom/itens/:idItem/status` | Sem login, rede interna | Única transição permitida `PRONTO → ENTREGUE`; atualizar status agregado na mesma transação, remover da retirada e publicar SSE para cozinha/bar e clientes. |
| US-15/18 | GET `/garcom/eventos` (SSE) | Sem login, rede interna | Mudanças na fila de itens prontos e chamadas pendentes; GETs dos recursos são snapshots iniciais/reconexão. |
| US-16 | GET `/atendimentos/:idComanda/pedidos` | Bearer da sessão de mesa vinculada | Pedidos e status de todos os itens da própria comanda, inclusive entregues; rejeitar sessão inválida ou de outra comanda. |
| US-16 | GET `/atendimentos/:idComanda/eventos` (SSE) | Bearer da sessão de mesa vinculada | Eventos de status restritos à comanda validada; reconectar com snapshot GET. Cliente usa streaming autenticado, não token em query string. |
| US-17 | GET `/garcom/mesas/:idMesa/comandas` | Sem login, rede interna | Todas as comandas ativas da mesa para seleção; não retornar dados pessoais desnecessários. |
| US-17 | GET `/garcom/comandas/:idComanda` | Sem login, rede interna | Detalhe de comanda ativa selecionada, pedidos/itens/status e total parcial (todos os pedidos confirmados). |
| US-18 | POST `/atendimentos/:idComanda/chamados` | Bearer da sessão vinculada | Criar chamada para a mesa da comanda; se já houver chamada pendente na mesa, retornar a existente sem duplicar. |
| US-18 | GET `/garcom/chamados` | Sem login, rede interna | Snapshot das chamadas pendentes, com mesa e horário. |
| US-18 | PATCH `/garcom/chamados/:idChamado/status` | Sem login, rede interna | Concluir chamada pendente; proteger alteração concorrente com status atual. |
| US-19 | GET `/administracao/categorias` | Sem login, rede interna | Listar categorias ativas e inativas. |
| US-19 | POST `/administracao/categorias` | Sem login, rede interna | Criar categoria ativa com nome validado. |
| US-19 | PATCH `/administracao/categorias/:idCategoria` | Sem login, rede interna | Editar nome e/ou ativar/inativar. Categorias inativas e produtos associados não aparecem no catálogo do cliente. |
| US-21 | GET `/atendimentos/:idComanda/extrato` | Bearer da sessão de mesa vinculada | Itens de todos os pedidos confirmados, qualquer status, quantidades, preço unitário, subtotais e total. |

O painel do garçom pode consumir snapshot de retirada e chamadas e uma única rota SSE de eventos. Confirmar estrutura final dos DTOs durante implementação; ocultar nome/CPF/telefone do cliente se não forem necessários à operação.

Evoluções de banco planejadas (não implementadas):

- US-19 requer tabela `Categoria` (id, nome, ativo e campos temporais conforme convenção local) e FK em Produto. Migration aditiva: criar categorias iniciais com nomes/códigos `PRATO`, `SOBREMESA`, `BEBIDA`; criar tabela, preencher e associar produtos existentes, depois adaptar leitura/DTO do catálogo. Não apagar histórico nem produtos ao inativar. Avaliar manter coluna enum antiga durante a transição da migration para facilitar compatibilidade e removê-la somente em mudança futura planejada.
- US-18 requer tabela de chamadas com id, mesa, status (`PENDENTE`, `CONCLUIDA`, `CANCELADA`) e timestamps de criação/finalização. Para serializar tentativas simultâneas da mesma mesa, bloquear a linha da mesa, buscar chamada pendente e retornar a existente; criar uma nova somente se não houver. Uma única chamada pendente por mesa deve também ser protegida por constraint/estratégia transacional adequada ao MySQL. Liberação da mesa cancela as pendentes atomicamente.
- US-21/17 usam `Produto.preco` persistido e não adicionam snapshot por item, conforme preço estável durante operação. Calcular valores com Decimal/centavos para evitar erros de ponto flutuante.
- Usar normalização de nome consistente entre aplicação e banco para cumprir unicidade sem distinção entre maiúsculas/minúsculas. Na liberação da mesa, atualizar chamadas pendentes para canceladas dentro da mesma transação que altera o estado da mesa e encerra as comandas.
- Não aplicar migrations a banco desconhecido; preservar histórico e usar migrations incrementais revisadas.

## Critérios de preparação

- Manter esta documentação e `AGENTS.md` autocontidos no clone e atualizados após cada decisão.
- Criar as pastas `screenshots/` e instruções locais dos módulos novos somente como estrutura de trabalho; não inventar capturas, telas ou dados.
- Ler referências Figma/capturas reais quando disponíveis antes de qualquer interface. Pastas vazias não autorizam inventar design.
- Não declarar rota, schema, autenticação ou regra pendente como confirmados; não implementar funcionalidades até haver autorização explícita.
- Após a implementação futura, executar `npm run check`, revisar migration, cobrir autorização/isolamento por comanda e testar eventos/conflitos com dados fictícios.
