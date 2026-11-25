# Sprint 4 — US-20, US-22, US-23, US-24, US-25 e US-26

## Escopo e estado — implementado em 25/11/2026

Escopo negociado pelo Grupo 9: **50 pontos**. Branch de integração: `sprint-04`, criada a partir da `main` com a Sprint 3 integrada (PR #6). As seis histórias estão implementadas na branch `codex/sprint-04-completa`, criada a partir de `sprint-04` (`182dcf0`). Critérios e decisões abaixo foram preservados. As seções de preparação descrevem a base histórica; o contrato final e as verificações desta entrega estão ao final.

Fonte dos cartões: `cartoes_UNICA_PLANILHA_DUPLEX.xlsx`, disponível fora do monorepo no ambiente de preparação. O conteúdo necessário está transcrito abaixo para que um clone seja autocontido. Frentes: H214:H224, H251:H261, A264:A274, H264:H274, A301:A311 e H301:H311; versos: A239:A249, A276:A286, H289:H299, A289:A299, H326:H336 e A326:A336. Critérios não devem ser deduzidos da numeração.

## Histórias e critérios da planilha

### US-20 — Setor responsável (13 pontos)

Como gerente, eu quero definir o setor responsável de cada item do cardápio para direcionar pedidos ao bar ou à cozinha.

Cada produto deve indicar se será preparado no bar ou na cozinha para que o pedido seja enviado ao setor correto.

- O sistema deve permitir escolher o setor responsável do produto.
- Produtos de bebida devem poder ser direcionados ao bar.
- Produtos de comida devem poder ser direcionados à cozinha.
- Pedidos confirmados devem ser separados conforme o setor do produto.

Tarefas técnicas do cartão: implementar campo de setor responsável na tela de produto; integrar seleção com o campo existente no banco; ajustar service de produto para salvar setor; ajustar roteamento de pedido por setor do produto; testar pedido com bebida para bar e comida para cozinha.

### US-22 — Solicitar fechamento (8 pontos)

Como cliente, eu quero solicitar o fechamento da comanda pelo dispositivo da mesa para encerrar o consumo.

O cliente solicita a conta, bloqueando novos pedidos e avisando garçom ou caixa.

- O cliente deve conseguir solicitar fechamento.
- A comanda deve mudar para aguardando pagamento.
- Novos pedidos devem ser bloqueados após solicitação.
- O garçom ou caixa deve receber o aviso de fechamento.

Tarefas técnicas do cartão: implementar ação de solicitar fechamento conforme Figma; criar/ajustar endpoint de fechamento da comanda; aplicar regra de bloqueio de novos pedidos; emitir alerta no painel operacional; testar tentativa de pedido após fechamento solicitado.

### US-23 — Consultar conta no caixa (5 pontos)

Como caixa, eu quero consultar uma comanda fechada para conferir o valor a ser pago.

O caixa busca comandas aguardando pagamento e confere o valor final. Neste cartão, "fechada" significa aguardando pagamento, não o estado terminal `FECHADA` do schema legado.

- O caixa deve visualizar comandas aguardando pagamento.
- A consulta deve exibir cliente, mesa e itens consumidos.
- O valor total deve ser calculado corretamente.
- Comandas abertas não devem aparecer como prontas para pagamento.

Tarefas técnicas do cartão: implementar tela do caixa conforme Figma; consumir endpoint de comandas aguardando pagamento; criar view de detalhes da conta; validar filtro por status da comanda; testar consulta e conferência de totais.

### US-24 — Registrar pagamento (13 pontos)

Como caixa, eu quero registrar o pagamento da comanda para finalizar o atendimento.

O caixa informa a forma de pagamento e encerra a comanda.

- O caixa deve selecionar forma de pagamento.
- O pagamento deve ser registrado no sistema.
- A comanda deve mudar para finalizada.
- O sistema deve impedir pagamento duplicado da mesma comanda.

Tarefas técnicas do cartão: implementar formulário de pagamento conforme Figma; criar/ajustar endpoint de registro de pagamento; integrar com schema existente de pagamentos/comandas; validar status antes de finalizar pagamento; testar pagamento válido e tentativa duplicada.

### US-25 — Liberação automática (3 pontos)

Como sistema, eu quero liberar automaticamente a mesa após o pagamento para permitir novo atendimento.

Quando a comanda for paga, a mesa vinculada deve voltar ao status disponível.

- A mesa deve ser liberada após pagamento confirmado.
- A comanda deve permanecer finalizada.
- A mesa liberada deve aparecer no mapa de mesas.
- O histórico da comanda não deve ser apagado.

Tarefas técnicas do cartão: adicionar regra pós-pagamento no service de pagamento; atualizar status da mesa vinculada no banco; atualizar mapa de mesas após finalização; garantir que dados históricos da comanda sejam preservados; testar liberação automática após pagamento.

### US-26 — Cadastro de produtos (8 pontos)

Como administrador, eu quero cadastrar itens do cardápio para manter produtos atualizados.

O administrador cadastra nome, descrição, preço, categoria, setor responsável e disponibilidade.

- O item deve ser salvo com os dados obrigatórios.
- O item deve ser associado a uma categoria existente.
- O item deve ser associado ao setor responsável correto.
- O item ativo deve aparecer no cardápio do cliente.

Tarefas técnicas do cartão: implementar tela conforme protótipo do Figma; conectar formulário aos campos existentes do banco; criar/ajustar endpoint de cadastro de item; validar preço, categoria, setor e disponibilidade; testar persistência e exibição do item ativo no cardápio.

## Base histórica conferida antes da implementação

- `apps/{recepcao,mesa,cozinha,bar,garcom,administracao}` já existiam. Reutilizar esses workspaces; não criar cópias. Nesta preparação, `apps/caixa` foi criado com prévia Electron e a navegação Produtos da administração abre um formulário de prévia; categorias continuam funcionais.
- `Produto` já possui nome, descrição opcional, preço Decimal(10,2), categoria como FK textual, setor `COZINHA | BAR` e `ativo`. `Categoria` já é uma entidade persistida, não um enum.
- `Comanda.status` já contém `ABERTA`, `EM_CONSUMO`, `CONTA_SOLICITADA`, `PAGA` e `FECHADA`. Não adicionar outro estado apenas para traduzir "aguardando pagamento" na interface.
- Não existe entidade de pagamento no schema atual. O verso da US-24 não é prova de que ela existe: será necessária persistência incremental.
- `sprint-service.ts::confirmarPedido` já rejeita novos pedidos em `CONTA_SOLICITADA`. Falta a ação que solicita a conta; preservar a verificação transacional e a sessão da própria comanda.
- Filas e alteração de status usam `Produto.setor` ao consultar. Mudar esse campo pode deslocar itens antigos entre setores. Decisão: bloquear troca de setor enquanto houver itens não entregues em atendimentos ativos, serializando com novos pedidos; registros de atendimentos já encerrados não devem bloquear indefinidamente o produto.
- Filas de cozinha/bar/garçom incluem comandas `CONTA_SOLICITADA`, mas excluem comandas pagas/fechadas. Decisão: pagamento somente com todos os itens entregues; solicitar conta pode ocorrer antes, sem eliminar o trabalho de preparo/entrega.
- Extrato soma todos os itens de pedidos confirmados, inclusive em preparo, usando preço vigente do produto. Não existe snapshot de preço por item. A regra anterior de preço estável durante operação continua válida; US-27 não está nesta sprint.
- A liberação manual da recepção encerra **todas** as comandas da mesa, revoga sessões, remove vínculos de cartões e cancela chamadas. **Não chamar esse método como atalho para pagamento individual.** Ele não registra pagamento.
- Cozinha/bar permitem correção entre etapas vizinhas `RECEBIDO ↔ EM_PREPARO ↔ PRONTO`; somente garçom marca `ENTREGUE`. Preservar os contratos existentes.

## Divisão e ordem de integração

| História | Interface | Backend e integração | Dependência |
|---|---|---|---|
| US-20 | Produtos na administração existente | Módulo administração; setor e roteamento comuns | Alinhar formulário/DTO com US-26 |
| US-22 | Mesa existente; aviso operacional | Comandas/sessão e eventos comuns | Base do fluxo US-23/24 |
| US-23 | Caixa | Consulta de contas e total no backend | US-22 para contas reais aguardando pagamento |
| US-24 | Caixa; aviso ao garçom | Pré-conta, taxas, registro do recebimento e finalização transacional | US-23; fluxo confirmado abaixo |
| US-25 | Sem app novo; refletir no mapa da recepção | Mesma transação de US-24 | US-24; liberar só após a última comanda ativa |
| US-26 | Produtos na administração existente | Cadastro, categoria e catálogo comuns | Coordenar arquivos compartilhados com US-20 |

Preparar contratos compartilhados antes de desenvolver consumidores. Cada integrante implementa a história solicitada, incluindo API, DTOs, cliente e testes necessários; não devolver tela com sucesso fictício. US-20/26 devem compartilhar a mesma área de produtos. US-24/25 devem compartilhar a mesma transação de pagamento, não serviços concorrentes que finalizam a mesma comanda separadamente.

## Contratos da Sprint 4 — implementados

Prefixo `/api`. As rotas abaixo estão implementadas, com complementos no contrato final ao fim deste documento. DTOs ficam em `packages/contracts`; chamadas em `packages/api-client`. Nenhum frontend acessa Prisma. O fluxo funcional confirmado não autoriza inventar comportamento adicional além destes critérios.

| História | Método/rota proposta | Entrada e resultado |
|---|---|---|
| US-20/26 | GET `/administracao/produtos` | Lista de gestão, incluindo produtos inativos; não usar catálogo do cliente como lista administrativa. |
| US-26 | POST `/administracao/produtos` | Nome, descrição, preço, categoria textual, setor e ativo; retorna produto persistido. Validar categoria e disponibilidade. |
| US-20 | PATCH `/administracao/produtos/:idProduto/setor` | `{setor}`; rejeitar mudança com itens não entregues em atendimentos ativos. Não incluir edição de preços da US-27. |
| US-22 | POST `/atendimentos/:idComanda/solicitar-fechamento` | Sessão bearer vinculada; forma de pagamento escolhida pelo cliente; transição para `CONTA_SOLICITADA`, sem pagamento nem liberação de mesa. Repetição não duplica avisos. |
| US-23 | GET `/caixa/comandas` | Apenas `CONTA_SOLICITADA`; identidade mínima para selecionar a conta. |
| US-23 | GET `/caixa/comandas/:idComanda` | Cliente (nome), mesa, itens, quantidades, valores e total recalculado pelo servidor. Não retornar CPF/telefone sem necessidade. |
| US-24 | POST `/caixa/comandas/:idComanda/preconta` | Taxas selecionadas; gerar e persistir versão com consumo, taxas, total e forma informada. Não quitar. |
| US-24 | POST `/caixa/comandas/:idComanda/chamar-garcom` | Solicitação de levar a pré-conta/receber, vinculada à comanda e à versão da conta. Não quitar nem duplicar pendência em reenvio. |
| US-24/25 | POST `/caixa/comandas/:idComanda/pagamento` | Referência da pré-conta conferida; valor obtido pelo servidor. Só após recebimento e entrega de todos os itens. Retorna confirmação persistida e situação da mesa. |

Administração e caixa usam acesso sem login exclusivamente em rede interna, conforme decisão do responsável. Sessão da mesa sempre validada na API. `CORS` não substitui restrição de rede nem autorização. Formato de erros permanece `{error:{code,message}}`; 400 entrada inválida, 401/403 autorização, 404 inexistente, 409 conflito. Não publicar rotas que retornam sucesso sem implementação.

## Fluxo de negócio definido na preparação

Decisões do responsável em 23/11/2026, complementando os cartões sem alterar sua pontuação negociada:

1. Cliente solicita fechamento **da própria comanda** e informa uma forma: dinheiro, Pix, débito ou crédito. Uma forma por comanda, pagamento integral e sem integração bancária. Rascunhos não entram na conta; seguir aviso/confirmar fechamento do Figma sem enviar pedidos implicitamente.
2. Caixa recebe a solicitação, confere itens e prepara uma **pré-conta**, para impressão ou download em PDF, sem emissão fiscal. US-23 fornece consulta e total de consumo; US-24 acrescenta composição/emissão e cobrança. Nunca rotular pré-conta como recibo de pagamento.
3. Caixa escolhe quais taxas aplicar e seus valores: nome, percentual sobre o consumo ou valor fixo em reais **por comanda**. Nenhuma taxa ativa por padrão. Não fixar 10% nem couvert como regra; exemplos são ilustrativos. Não implementar rateio por pessoa/mesa. Calcular cada percentual sobre o subtotal de consumo, sem taxa sobre taxa; arredondar cada linha para centavos e somar os valores exibidos. Validar valores não negativos e precisão/limites monetários; não confiar no total do frontend.
4. Pré-conta discrimina itens, quantidades, valores unitários/subtotais, subtotal de consumo, cada taxa, total e forma informada. Preservar seus valores/versão para impedir pagamento de documento desatualizado. A emissão não finaliza comanda nem revoga sessão.
5. Caixa chama o garçom para levar a pré-conta e receber na mesa. O aviso deve identificar mesa e comanda e ser recuperável após reconexão. Não confundir esse fluxo com o chamado genérico da US-18, que é único por mesa.
6. Orientação adotada na preparação, após o responsável pedir recomendação: **o caixa confirma a quitação após retorno do garçom**. Garçom recebe fisicamente; atender um chamado não registra pagamento. A UI de confirmação do caixa deve deixar explícito que confirma recebimento, não apenas emissão da pré-conta.
7. Pagamento só pode finalizar se todos os itens estiverem `ENTREGUE`. O bloqueio é do pagamento, não da solicitação da conta; filas continuam tratando pedidos enquanto `CONTA_SOLICITADA`.
8. Usar `PAGA` como estado terminal proposto para quitação, com `dataFechamento`; `FECHADA` permanece o encerramento manual legado sem prova de pagamento. Não passar para `FECHADA` apagando a distinção financeira. Não alterar comportamento legado incidentalmente; eventual restrição da liberação manual precisa ser tratada explicitamente.
9. Finalizar/revogar sessões/liberar cartão somente da comanda paga. **Mesa fica livre apenas quando não restar outra comanda ativa.** Preservar todas as outras comandas; atualizar mapa da recepção e cancelar chamadas pendentes da mesa somente quando ela for efetivamente liberada.
10. Alteração de setor: bloquear enquanto houver itens não entregues de atendimentos ativos. Revalidar sob proteção transacional compatível com a confirmação de pedidos para não abrir uma corrida entre consulta e alteração. Não inferir setor pelo nome da categoria: categorias são dinâmicas.

O responsável autorizou adaptar formulários de produtos, taxas e pré-conta ao padrão existente porque o Figma não detalha essas telas. Ver `figma-sprint-04.md`. Estorno, cancelamento da solicitação, parcelamento/divisão entre meios, desconto, upload, emissão fiscal e integração bancária não fazem parte da preparação.

## Transações, dados e cenários de verificação

- Serializar solicitação de fechamento e confirmação de pedido pelo lock de mesa já existente; revalidar status após adquirir o lock. Se o fechamento vencer, não pode entrar pedido novo.
- Pagamento deve conferir status e total no backend, ter unicidade persistida por comanda e ser atômico com finalização, liberação do cartão e revogação das sessões daquela comanda. Dois caixas ou um reenvio não podem cobrar/gravar duas vezes. Definir resposta de repetição na implementação, sem usar cache em memória como única proteção.
- Preservar histórico de pagamento e valor pago. Usar Decimal/centavos; não confiar no total enviado pelo cliente. Planejar migration incremental de pagamento com vínculo, valor, forma e data; não alterar migrations aplicadas nem inventar pagamentos para comandas antigas.
- Mesa pode ter múltiplas comandas. Não encerrar outra comanda ao pagar uma. Liberar somente sem outra comanda ativa; testar pagamento concorrente das últimas comandas e abertura concorrente de novo atendimento.
- Eventos somente após commit. Reconciliar snapshots ao abrir/reconectar; aviso de fechamento deve ser recuperável após reinício, sem depender só de evento efêmero. Reutilizar SSE existente quando apropriado, preservando `fila`/`chamados` e isolamento por sessão.
- US-20: testar cadastro/setor inválido e pedido misto, preservando correções e entrega do garçom; cobrir alteração concorrente de setor conforme decisão.
- US-22: testar sessão ausente/expirada/de outra comanda, repetição, bloqueio de pedido e aviso recuperável.
- US-23: filtrar contas abertas/pagas/fechadas, tratar lista vazia, atualizar conta alterada por outro caixa e conferir total igual ao extrato.
- US-24/25: duplicidade concorrente, rollback, status inválido, perda de conexão, múltiplas comandas, preservação de histórico e revogação somente das sessões corretas. Cancelar chamadas pendentes quando a mesa for efetivamente liberada, preservando o registro.
- US-26: campos obrigatórios, limites do schema, preço válido, categoria existente, setor válido, produto inativo invisível e categoria inativa ocultando produto. Não adicionar upload ou CRUD completo da US-27 por conveniência.
- Depois de implementação, executar `npm run check` e testes MySQL em banco descartável; registrar limitações ambientais separadamente. Não aplicar migrations no banco de operação como parte da preparação.

## Estrutura histórica da preparação e referências

- `apps/caixa`: workspace Electron/Vite, porta 5179; prévia navegável de consulta, taxas e pré-conta. Scripts `dev:caixa` e `package:caixa` na raiz; incluído no `dev` geral. API continua separada na porta 3333.
- `apps/administracao/src/ProdutosPreview.tsx`: estrutura do formulário compartilhado US-20/26, acessível pela navegação Produtos. Não grava e não altera a gestão de categorias existente.
- `apps/api/src/modules/caixa/AGENTS.md`: local reservado e instruções para o backend futuro, sem endpoints fictícios.
- `docs/figma-sprint-04.md`: links/nós verificados, capturas reais versionadas e limites das adaptações. Mesa/garçom existentes serão integrados na implementação das histórias, sem ativar fechamento prematuramente.
- `AGENTS.md`, instruções locais e `.agents/agents/api-sprint4.md`: contexto autocontido para as IAs do grupo. `CLAUDE.md` já referencia `AGENTS.md` e não precisa duplicá-lo.

Na preparação de 23/11 não foram criadas migrations. A implementação de 25/11 acrescenta a migration descrita abaixo; os contratos HTTP acima agora são funcionais. Decisões de negócio confirmadas não precisam ser perguntadas novamente; pergunte se surgir comportamento novo ou conflito real. Não implementar estorno, edição de preços ou relatórios sem novo escopo.

## Verificação da preparação — 23/11/2026

- `npm run check` aprovado: lint, tipos de todos os workspaces, 28 testes aprovados, builds e validação Prisma. Três suítes MySQL opt-in não foram executadas; não houve mudança de persistência. A primeira execução teve conexões locais bloqueadas pelo sandbox (`EACCES`); a repetição fora dele passou.
- Após reutilizar o componente `Button` comum nas prévias, lint, tipos e builds de caixa/administração foram repetidos e aprovados.
- Conferência Electron em janelas ocultas e sem acesso à API de operação: navegação caixa/pré-conta e categorias/produtos, ações de gravação desativadas e ausência de overflow horizontal em 1440 e 760 pixels. Capturas inspecionadas visualmente. Captura inicial com GPU falhou; renderização sem GPU concluiu.
- Lockfile preserva dependências existentes; foram adicionados somente o workspace do caixa e seu vínculo. Não houve atualização de bibliotecas.

## Como solicitar uma história à IA

Exemplo: "Implemente a US-22 da Sprint 4. Leia AGENTS.md, docs/sprint-04.md e as instruções dos módulos afetados. Confira código e referências visuais, preserve contratos existentes e pergunte sobre decisões pendentes que afetem esta história. Atualize documentação de contratos e estado e execute as verificações pertinentes."

Antes de começar, atualizar a branch de trabalho com a integração `sprint-04` conforme o fluxo Git do grupo. Ao concluir uma história, registrar o estado real, contratos finais, migrations e verificações neste documento; substituir a proposta correspondente, sem deixar afirmações contraditórias de implementação/prévia.


## Entrega funcional — 25/11/2026

- **US-20/26:** cadastro real e lista administrativa (inclusive inativos), categoria existente, preço/descrição/disponibilidade validados, alteração exclusiva de setor. Pedido confirmado bloqueia produtos por ID ordenado; alteração de setor usa o mesmo lock e rejeita itens não entregues em atendimentos ativos. Nenhuma edição de preços ou upload foi acrescentada.
- **US-22:** confirmação real com forma de pagamento, aviso de carrinho não enviado, descarte local somente após sucesso, bloqueio de novos pedidos sob lock da mesa. Consulta periódica recupera fechamento após troca de sessão/dispositivo; extrato e acompanhamento permanecem acessíveis até quitação. Reenvio com mesma forma retorna o mesmo fechamento; forma diferente retorna 409.
- **US-23:** caixa lista apenas `CONTA_SOLICITADA` e revalida o detalhe a cada dois segundos; consumo é calculado pela API, sem CPF/telefone. Estado vazio/indisponível e conflito não simulam contas.
- **US-24:** pré-conta persistida e versionada, taxas opcionais e nenhuma por padrão, emissão separada da quitação, aviso recuperável ao garçom. Uma taxa percentual aceita de 0 a 100%, duas casas decimais, até 20 taxas; valor fixo/preço/total de até R$ 99.999.999,99. Cada percentual usa o subtotal e arredondamento decimal meio para cima por linha. O servidor rejeita valor/total informado na chamada de pagamento.
- **US-25:** pagamento único por comanda, status `PAGA` e data, revogação somente de suas sessões e remoção de seu vínculo de cartão, na mesma transação. Mesa liberada e chamados genéricos cancelados apenas quando não houver outra comanda ativa. Não usa liberação manual e preserva histórico.

### Contratos finais complementares

Todos usam `/api`; formato de erros já existente, sem cache. Administração/caixa/garçom permanecem exclusivos da rede interna, sem login por decisão do grupo. Mesa exige Bearer da própria sessão.

| Método e rota | Contrato |
|---|---|
| GET `/administracao/produtos` | `ProdutoGestaoDto[]`, inclui disponibilidade própria e estado/nome da categoria. |
| POST `/administracao/produtos` | `{nome,descricao?,preco,categoria,setor,ativo}` → 201 produto persistido. Preço em reais, número com até duas casas. |
| PATCH `/administracao/produtos/:idProduto/setor` | Somente `{setor}`. 409 `SETOR_EM_USO` se houver itens pendentes ativos. |
| GET `/atendimentos/:idComanda/fechamento` | Sessão vinculada → `{idComanda,status,formaPagamento,solicitadoEm}`. |
| POST `/atendimentos/:idComanda/solicitar-fechamento` | Somente `{formaPagamento: "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO"}`; idempotente para mesma forma. |
| GET `/caixa/comandas` | Contas aguardando pagamento: ID, mesa, nome, forma e horário. |
| GET `/caixa/comandas/:idComanda` | Itens/valores/subtotal, `todosEntregues` e última `preconta`. Aberta/paga/fechada retorna 409. |
| GET `/caixa/eventos` | SSE `contas` com snapshot completo da lista; reconciliação a cada 2s, retry 3s, heartbeat 15s, `indisponivel` em falha. |
| POST `/caixa/comandas/:idComanda/preconta` | Somente `{taxas:[{nome,tipo:"PERCENTUAL"|"FIXA",valor}]}` → 201 `PrecontaDto` imutável. Cada emissão cria versão. Bloqueada enquanto uma cobrança anterior estiver pendente. |
| GET `/caixa/precontas/:idPreconta` | Documento preservado da versão emitida, inclusive após pagamento, para conferência/impressão. |
| POST `/caixa/comandas/:idComanda/chamar-garcom` | Somente `{idPreconta}` vigente; um aviso por versão, reenvio não duplica. |
| GET `/garcom/contas` e GET `/garcom/contas/eventos` | Snapshot `{solicitacoes,cobrancas}` sem nome/CPF/telefone do cliente; SSE `contas`, mesmas regras de reconexão. Fechamento é por comanda; não substitui chamada genérica por mesa. |
| PATCH `/garcom/cobrancas/:idCobranca/status` | `{status:"CONCLUIDA"}` registra retorno ao caixa; nunca quita. Repetição não duplica ação. |
| POST `/caixa/comandas/:idComanda/pagamento` | Somente `{idPreconta}` conferida. API calcula valor da versão, exige consumo atual correspondente e todos os itens entregues, registra e finaliza atomicamente. Retorna `PagamentoDto` e `mesaLiberada`. |

Conflitos: `PAGAMENTO_DUPLICADO`, `ITENS_PENDENTES`, `PRECONTA_DESATUALIZADA`, `COBRANCA_PENDENTE`, `CONTA_INDISPONIVEL` e `FECHAMENTO_JA_SOLICITADO` retornam 409. Uma versão antiga ou cujo consumo/preço foi alterado não pode ser cobrada. O botão do caixa exige confirmação explícita do recebimento integral; concluir aviso do garçom não prova quitação. Liberação manual legada continua distinta de pagamento e pode encerrar atendimentos sem registro financeiro; não foi alterada incidentalmente.

### Banco e execução

Migration incremental `20261125000000_fechamento_pagamento`: forma/horário de solicitação em Comanda, `preconta` com snapshot JSON, `cobranca` única por versão, `pagamento` único por comanda e pré-conta, com valor/forma/data. Registros antigos não recebem pagamento fictício; não houve aplicação no banco do grupo. Todas as migrations anteriores foram preservadas.

Após conferir que `DATABASE_URL` aponta para o banco de desenvolvimento correto: `npm ci`, `npm run db:generate`, `npm run db:deploy`. Executar `dev:api`, `dev:mesa`, `dev:administracao`, `dev:garcom`, `dev:caixa` e recepção conforme necessário. A API continua única.

Caixa Electron usa `RESTAURANTE_CAIXA_API_URL` (ou `VITE_API_URL`) no processo, padrão `http://127.0.0.1:3333/api`, com HTTP somente local/IPv4 privada ou HTTPS. O preload expõe somente a URL pública e a ação restrita de documento. Impressão/PDF lê uma pré-conta persistida da API configurada, escapa texto e renderiza em janela oculta isolada. O renderer não envia HTML, caminho de arquivo ou URL arbitrária. PDF usa diálogo nativo de destino. No navegador, impressão permite escolher Salvar como PDF. Sem emissão fiscal.

### Verificações reproduzíveis

- `RUN_MYSQL_TESTS=1` e `TEST_DATABASE_URL` local habilitam todas as suítes em bancos aleatórios descartáveis; não migram o banco indicado na URL.
- `npm run check`: lint, tipos, testes HTTP/financeiros/integração, builds e validação Prisma.
- `npm run test:sprint4:desktop` após build, com `TEST_DATABASE_URL`: apps Electron ocultos, cadastro real, aviso do carrinho, fechamento, taxas, pré-conta/PDF, recebimento pelo garçom, pagamento, liberação e revogação. `DESKTOP_SCREENSHOT_DIR` opcional preserva evidências locais.
- Cobertura adicional de banco: versões obsoletas, isolamento, duplicidade concorrente, rollback induzido após inserção do pagamento, quitação simultânea das últimas comandas, fechamento versus pedido e setor versus confirmação.

Fora do escopo: estorno, cancelamento/reabertura da conta, parcelamento, múltiplas formas, descontos, US-27/28/29, upload, documento fiscal e integração bancária.

### Resultado da validação desta entrega

`npm run check` aprovado em Node 24, com **42 testes aprovados e nenhum ignorado**, incluindo todas as suítes MySQL opt-in em MariaDB local descartável. Lint, tipos, builds de todos os apps e schema Prisma aprovados. `npm run test:sprint4:desktop` aprovado: pagamento real de R$ 110,89 persistido após pré-conta com consumo R$ 99,80, serviço de 10% e taxa fixa R$ 1,11. Capturas de produtos, mesa, garçom e caixa conferidas; PDF de uma página renderizado e acentos/valores inspecionados. Layout sem overflow horizontal em desktop e caixa com largura 760. Nenhum dado do banco do grupo foi alterado.
