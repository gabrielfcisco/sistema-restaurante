# Sprint 4 — US-20, US-22, US-23, US-24, US-25 e US-26

## Escopo e estado

Escopo negociado pelo Grupo 9: **50 pontos**. Branch de integração: `sprint-04`, criada a partir da `main` com a Sprint 3 integrada (PR #6). Esta entrega prepara instruções, contratos propostos e estrutura; não implementa as histórias. Uma solicitação explícita de uma história autoriza sua implementação, respeitadas as decisões registradas abaixo.

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

## Base existente conferida no código

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

## Contratos propostos — ainda não implementados

Prefixo `/api`. Nomes abaixo são propostas de integração; inspecionar rotas existentes antes de fixá-los. DTOs ficam em `packages/contracts`; chamadas em `packages/api-client`. Nenhum frontend acessa Prisma. O fluxo funcional confirmado não autoriza inventar comportamento adicional além destes critérios.

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

## Estrutura entregue e referências

- `apps/caixa`: workspace Electron/Vite, porta 5179; prévia navegável de consulta, taxas e pré-conta. Scripts `dev:caixa` e `package:caixa` na raiz; incluído no `dev` geral. API continua separada na porta 3333.
- `apps/administracao/src/ProdutosPreview.tsx`: estrutura do formulário compartilhado US-20/26, acessível pela navegação Produtos. Não grava e não altera a gestão de categorias existente.
- `apps/api/src/modules/caixa/AGENTS.md`: local reservado e instruções para o backend futuro, sem endpoints fictícios.
- `docs/figma-sprint-04.md`: links/nós verificados, capturas reais versionadas e limites das adaptações. Mesa/garçom existentes serão integrados na implementação das histórias, sem ativar fechamento prematuramente.
- `AGENTS.md`, instruções locais e `.agents/agents/api-sprint4.md`: contexto autocontido para as IAs do grupo. `CLAUDE.md` já referencia `AGENTS.md` e não precisa duplicá-lo.

Não foram criadas migrations nem aplicadas mudanças de banco nesta preparação. Contratos HTTP e persistência acima são propostas para implementação. Decisões de negócio confirmadas não precisam ser perguntadas novamente; pergunte se surgir comportamento novo ou conflito real. Não implementar estorno, edição de preços ou relatórios sem novo escopo.

## Verificação da preparação — 23/11/2026

- `npm run check` aprovado: lint, tipos de todos os workspaces, 28 testes aprovados, builds e validação Prisma. Três suítes MySQL opt-in não foram executadas; não houve mudança de persistência. A primeira execução teve conexões locais bloqueadas pelo sandbox (`EACCES`); a repetição fora dele passou.
- Após reutilizar o componente `Button` comum nas prévias, lint, tipos e builds de caixa/administração foram repetidos e aprovados.
- Conferência Electron em janelas ocultas e sem acesso à API de operação: navegação caixa/pré-conta e categorias/produtos, ações de gravação desativadas e ausência de overflow horizontal em 1440 e 760 pixels. Capturas inspecionadas visualmente. Captura inicial com GPU falhou; renderização sem GPU concluiu.
- Lockfile preserva dependências existentes; foram adicionados somente o workspace do caixa e seu vínculo. Não houve atualização de bibliotecas.

## Como solicitar uma história à IA

Exemplo: "Implemente a US-22 da Sprint 4. Leia AGENTS.md, docs/sprint-04.md e as instruções dos módulos afetados. Confira código e referências visuais, preserve contratos existentes e pergunte sobre decisões pendentes que afetem esta história. Atualize documentação de contratos e estado e execute as verificações pertinentes."

Antes de começar, atualizar a branch de trabalho com a integração `sprint-04` conforme o fluxo Git do grupo. Ao concluir uma história, registrar o estado real, contratos finais, migrations e verificações neste documento; substituir a proposta correspondente, sem deixar afirmações contraditórias de implementação/prévia.
