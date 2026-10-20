# Sprint 2 — Preparação técnica das US-07 a US-13 (Grupo 9)

## Escopo e estado

Este documento registra os critérios fornecidos para preparar arquitetura e contratos. Não implementa endpoints, telas, upload ou migration. O sistema atual continua na Sprint 1. As novas rotas descritas aqui são propostas justificadas pelos critérios e não estão registradas no servidor até serem implementadas.

## Mapeamento de histórias

| História | Módulo consumidor | Responsabilidade da API | Entidades principais |
|---|---|---|---|
| US-07 — Cardápio por categorias | `apps/mesa` | Exibir categorias e produtos ativos; filtrar e alternar categoria; sinalizar disponibilidade. | Produto (hoje categoria enum), setor |
| US-08 — Detalhes do item | `apps/mesa` | Buscar nome, descrição, preço, imagem e disponibilidade; impedir inclusão indisponível no servidor. | Produto |
| US-09 — Montagem do pedido | `apps/mesa` | Estado de edição no cliente; validar quantidades não negativas e produto disponível ao confirmar. | Comanda, Produto; ItemPedido persistido na confirmação |
| US-10 — Revisão do pedido | `apps/mesa` | Exibir itens e subtotal calculado com preço vigente; bloquear pedido vazio. | Produto, Comanda; rascunho no cliente |
| US-11 — Confirmação e distribuição | `apps/mesa` → API → filas operacionais | Validar comanda ativa, produto/preço/disponibilidade e quantidades; gravar pedido/itens atomicamente; separar itens por `Produto.setor`; iniciar status equivalente a recebido. | Comanda, Pedido, ItemPedido, Produto, Mesa |
| US-12 — Painel da cozinha | `apps/cozinha` | Listar somente itens COZINHA recebidos/em preparo, com mesa, comanda e chegada, ordenados pela chegada. | ItemPedido, Pedido, Produto, Comanda, Mesa |
| US-13 — Painel do bar | `apps/bar` | Listar somente setor BAR, com mesa, comanda e chegada, ordenados pela chegada. | ItemPedido, Pedido, Produto, Comanda, Mesa |

Recepção permanece responsável pelos fluxos Sprint 1 e não tem mudança justificada por essas histórias. Cozinha e bar são consumidores distintos da mesma API e não possuem backend ou banco próprios. `apps/mesa` já existe; os novos apps de cozinha/bar são apenas diretórios de referência `screenshots/` nesta preparação, sem workspace executável.

## Contratos de rota planejados

Base `/api`. São os menores contratos de leitura/escrita que cobrem os critérios. Não adicionar endpoints de CRUD, detalhe, cancelamento ou transição de status sem critério de história. Filtros por setor são impostos pelo servidor e não confiados ao cliente.

| História | Método e rota proposta | Uso e dados | Permissão/autenticação prevista |
|---|---|---|---|
| US-07 | `GET /cardapio/categorias` | Valores de categoria representados por produtos ativos, para navegação conforme Figma. | Sessão de cliente da mesa (Bearer da sessão validada em `/acessos/mesa`). |
| US-07 | `GET /cardapio/produtos?categoria=<id>` | Produtos ativos da categoria: id, nome, descrição curta, preço, disponibilidade, caminho/URL de imagem. Alternância é nova consulta/filtragem. | Sessão de cliente da mesa. |
| US-08 | `GET /cardapio/produtos/:idProduto` | Detalhe de produto, incluindo descrição, preço e disponibilidade; produto desativado informa indisponibilidade em vez de 404. Imagem de teste lida pela chave relativa persistida. | Sessão de cliente da mesa. |
| US-09/10/11 | `POST /atendimentos/:idComanda/pedidos` | Cada confirmação cria um novo Pedido na mesma comanda, contendo somente os itens atuais; chave de idempotência evita duplicação. Resposta inclui itens classificados por setor. | Sessão de cliente; servidor verifica que sessão pertence à comanda indicada e que comanda permanece ativa. A API recalcula valores e valida disponibilidade. |
| US-12 | `GET /cozinha/itens` | Itens não entregues do setor COZINHA (`RECEBIDO`, `EM_PREPARO`, `PRONTO`), contendo produto, quantidade, status, mesa/comanda e horário de chegada; ordem crescente. PRONTO permanece visível para permitir marcar ENTREGUE. | Leitura sem login, rede interna. |
| US-12 | `GET /cozinha/eventos` (SSE) | Eventos de novos itens e mudanças de status para atualizar a fila; GET de itens é snapshot inicial/reconexão. | Leitura sem login, rede interna. |
| US-12 | `PATCH /cozinha/itens/:idItem/status` | Avançar item COZINHA em uma etapa (`EM_PREPARO`, `PRONTO`, `ENTREGUE`); validar sequência, setor e concorrência. | Ação no painel, sem login, rede interna. |
| US-13 | `GET /bar/itens` | Itens não entregues do setor BAR (`RECEBIDO`, `EM_PREPARO`, `PRONTO`), com mesmos dados e ordenação. PRONTO permanece visível para permitir marcar ENTREGUE. | Leitura sem login, rede interna. |
| US-13 | `GET /bar/eventos` (SSE) | Eventos de novos itens e mudanças de status; GET de itens é snapshot inicial/reconexão. | Leitura sem login, rede interna. |
| US-13 | `PATCH /bar/itens/:idItem/status` | Avançar item BAR em uma etapa (`EM_PREPARO`, `PRONTO`, `ENTREGUE`); validar sequência, setor e concorrência. | Ação no painel, sem login, rede interna. |

Os painéis avançam status dos itens do próprio setor em sequência `RECEBIDO → EM_PREPARO → PRONTO → ENTREGUE`; não aceitam retrocesso nem salto. O backend verifica setor e status atual na gravação para evitar ações concorrentes conflitantes. SSE publica itens novos e mudanças de status; o GET da fila fornece snapshot inicial e reconcilia após reconexão.

## Regras de negócio confirmadas pelo Grupo 9

- **Categorias:** nesta sprint não há cadastro/administração de categorias ou produtos. Consultar o que estiver persistido e apresentar categorias/itens conforme o Figma. O schema atual guarda categoria como enum em Produto e pode agrupá-los. Cadastro de produtos/categorias pertence a sprint futura.
- **Disponibilidade:** Produto ativo (`ativo = true`) pode aparecer no cardápio. Produto inativo não aparece como opção selecionável. A API revalida `ativo` ao confirmar. Se for solicitado pelo detalhe após desativação, a API informa que está indisponível.
- **Status:** pedido e itens novos iniciam em `RECEBIDO`. Cada item avança no painel do setor: `RECEBIDO → EM_PREPARO → PRONTO → ENTREGUE`. O status agregado do Pedido é o estágio menos avançado entre seus itens; por exemplo, com itens `RECEBIDO` e `EM_PREPARO`, o Pedido fica `RECEBIDO`. Quando todos chegarem a `ENTREGUE`, o Pedido também fica `ENTREGUE`. Recalcular o agregado na mesma transação de cada mudança de status do item. O enum atual de ItemPedido não contém `RECEBIDO` e precisa de evolução aditiva. Cada confirmação cria Pedido novo na mesma comanda; os anteriores ficam no histórico e não são reenviados.
- **Preço:** preço não muda durante o funcionamento. Subtotal é soma de quantidade × preço persistido no Produto. O servidor nunca confia em preço enviado pelo cliente. Não adicionar snapshot por item nesta sprint; rever histórico quando administração/edição de cardápio e fechamento forem especificados.
- **Chegada:** instante da confirmação do pedido; usar `Pedido.dataHora`, sem timestamp redundante por item.
- **Quantidade zero:** remover a linha do rascunho no cliente. Pedido vazio não pode ser confirmado. Negativos e valores não inteiros são inválidos; API aceita apenas quantidades positivas.
- **Atualização dos painéis:** SSE foi escolhido para atualizar cozinha e bar em tempo real. Usar snapshot GET no início/reconexão e reconectar o stream automaticamente. Painel mantém itens até `ENTREGUE`; itens entregues nunca voltam às filas. Pedido/comanda adicional publica somente as linhas novas.
- **Operadores:** sem login nos painéis. Ao iniciar o app, a fila do setor aparece. As rotas de leitura não exigem autenticação. Hospedar API e painéis em rede interna; configurar `HOST` para interface da rede e `CORS_ORIGINS` somente com as origens internas utilizadas.
- **Imagens:** usar uma imagem genérica de teste escolhida pelo implementador, versionada em `assets/cardapio/`. Persistir no banco o caminho relativo correspondente; não inventar que ela é a foto real daquele produto. Administração e troca por imagens reais ficam para sprint futura.

## Integração e consistência

1. A sessão já existente é emitida por `POST /acessos/mesa`; `GET /acessos/mesa` revalida sessão, comanda, cartão e mesa. A nova leitura de catálogo exige essa sessão, sem credencial de instalação de dispositivo.
2. O cliente mantém seleção/quantidades enquanto edita e revisa; quantidade zero remove a linha. O subtotal é soma de quantidade × preço do Produto persistido; o servidor recalcula no envio.
3. Na confirmação, numa transação MySQL: validar comanda ativa e vínculo da sessão, lista não vazia, produtos ativos e quantidades inteiras positivas; criar novo Pedido e seus ItemPedido com status inicial `RECEBIDO`; atribuir setor por `Produto.setor` e definir `Pedido.dataHora` no instante da confirmação. Não modificar nem reenviar pedidos/itens anteriores da comanda. Qualquer falha reverte tudo. Idempotência evita duplicar pedido em retry.
4. Consultas da cozinha e do bar filtram setor/status no backend e juntam `ItemPedido → Pedido → Comanda → Mesa`; nunca aceitar setor enviado pelo frontend. Mostrar itens não entregues, inclusive PRONTO para a ação final, ordenar por `Pedido.dataHora` crescente e publicar eventos SSE de pedidos novos/mudanças. Itens históricos entregues permanecem disponíveis para fechamento, sem reaparecer na fila.

## Gaps e decisões de banco

O Prisma já declara `Produto` (categoria enum PRATO/SOBREMESA/BEBIDA, setor COZINHA/BAR, ativo, preço e descrição), `Pedido` (dataHora, status texto, comanda) e `ItemPedido` (quantidade unsigned, observação, status enum PENDENTE/EM_PREPARO/PRONTO/ENTREGUE). As tabelas/constraints correspondentes existem na migration inicial; preservá-la.

Antes de implementar, avaliar migration incremental para:

- **Categorias administráveis:** fora desta sprint. `Produto.categoria` enum existente atende ao agrupamento dos produtos persistidos; CRUD e categorias dinâmicas pertencem à sprint futura de administração.
- **Disponibilidade:** regra definida por `Produto.ativo`; não criar outro campo nesta sprint.
- **Imagem:** o campo de referência é necessário para o asset de teste. Adicionar campo opcional de chave relativa em Produto, por exemplo `imagemPath`, por migration aditiva; não implementar upload/administração. Versionar arquivo em `assets/cardapio/` e servir pela API/build conforme ambiente.
- **Status recebido:** Pedido e ItemPedido novos iniciam em `RECEBIDO`; adicionar esse valor ao enum do ItemPedido por migration e ajustar criação. O painel do setor executa RECEBIDO → EM_PREPARO → PRONTO → ENTREGUE. Recalcular status do Pedido na mesma transação como o estágio menos avançado de seus itens; assim, só avança quando todos avançarem. Fica ENTREGUE quando todos os itens ficam ENTREGUE.
- **Preço histórico:** sem snapshot nesta sprint; preço é estável durante funcionamento e lido do Produto.
- **Horário de chegada:** usar `Pedido.dataHora` como instante da confirmação, para todos os itens do pedido.

Preservar relações existentes (comanda e produto com `Restrict`; item apagado em cascata só quando pedido removido conforme schema) e a regra de múltiplas comandas ativas por mesa. Pedido deve pertencer à comanda ativa; fechamento/liberação não pode apagar seu histórico.

## Imagens do cardápio

Não há hoje pasta pública central de assets nem storage externo configurado; Vite gera bundles `dist/assets` específicos por app e Electron empacota esses bundles. Criar arquivos em `assets/cardapio/` como fonte central versionada (pasta preparada, sem imagens nesta entrega). Convenção: nomes minúsculos ASCII em kebab-case e extensão real (`hamburguer-da-casa.webp`); caminho armazenado relativo à raiz lógica, por exemplo `cardapio/pratos/hamburguer-da-casa.webp`. Não persistir caminho absoluto ou bytes/base64.

Versionar a imagem genérica de teste escolhida pelo implementador em `assets/cardapio/`, por nome minúsculo ASCII em kebab-case e extensão correta. Persistir em Produto uma chave/caminho relativo como `cardapio/placeholder-cardapio.webp`, nunca bytes/base64 ou caminho absoluto. A API deve expor o arquivo por URL apropriada para desenvolvimento e deploy na rede interna. Upload e troca por imagens reais ficam para sprint futura.

## Autorização e pendências

- Mesa usa token de sessão temporário, armazenado como hash, com validação de expiração/revogação/vínculo conforme padrão existente. Não usar o token do dispositivo como sessão do cliente.
- As filas dos painéis são sem autenticação e devem ser servidas na rede interna; definir/configurar interface `HOST` e origens internas permitidas em `CORS_ORIGINS` no deploy.
- Regra confirmada pelo Grupo 9 para o status geral durante estados mistos: usar o estágio menos avançado dos itens e recalculá-lo na mesma transação da atualização de item. Painéis executam transições por PATCH e publicam mudanças SSE. Reconexão SSE deve atualizar snapshot para evitar eventos perdidos. Administração/upload e imagens reais ficam para sprint futura.
- Não acrescentar CRUD de catálogo, upload ou ações de preparo fora dos critérios acima. Não expor dados além do necessário às filas.
