# Banco — Sprint 01

## Sprint 4 — persistência

Migration incremental `20261125000000_fechamento_pagamento`: `Comanda.formaPagamento` e horário da solicitação, `PreConta` com documento JSON imutável por emissão, `Cobranca` única por pré-conta e `Pagamento` único por comanda/versão, com valor Decimal(14,2), forma e data. Sem backfill financeiro. `PAGA` indica quitação; `FECHADA` continua encerramento manual legado. Transação com lock de mesa registra pagamento, revoga apenas suas sessões, libera só seu cartão e, após a última comanda ativa, libera mesa/cancela chamados. Critérios e execução em [sprint-04.md](sprint-04.md). Não foi migrado o banco do grupo.

US-12/13 acrescentam a migration aditiva `20261022000000_status_recebido`, preservando o histórico. Consulte [compatibilidade e execução](us-12-us-13.md). Aplicar somente após revisar o destino de desenvolvimento.

MySQL 8 / Prisma. A migration inicial foi preservada. A nova `20261003000000_sprint01` acrescenta:

- Estados RESERVADA e MANUTENCAO em mesa.
- Cartao com ID sequencial e código físico único de cinco dígitos.
- Referência opcional de Comanda a Cartao para preservar histórico.
- VinculoCartao: chave primária idCartao e idComanda único, impedindo uso ativo simultâneo.
- Chave de abertura única e hash dos parâmetros em Comanda para idempotência.
- SessaoMesa com hash do token, expiração e revogação.

Abertura bloqueia a linha da mesa e do cartão, e grava cartão/comanda/vínculo/estado na mesma transação. Liberação bloqueia a mesa, encerra todas as comandas ativas, revoga sessões e remove vínculos ativos. Deadlocks e colisões transitórias de criação são repetidos até duas vezes; conflitos persistentes retornam erro. Cadastro de CPF também tem unicidade no banco.

## Compatibilidade com registros anteriores

Comanda.qrCode passa a aceitar nulo; valores existentes e a unicidade histórica são preservados. Não gerar outro QR por atendimento. As novas aberturas usam Cartao.codigo e deixam qrCode nulo.

A migration não converte automaticamente QRs antigos em cartões: não é possível presumir que sejam códigos físicos válidos de cinco dígitos. Registros antigos continuam consultáveis no detalhe da mesa, com codigoCartao nulo, e podem ser encerrados pela liberação. Não abrem novas sessões pelo QR legado. Antes de migrar um banco com atendimentos ativos, revisar e planejar a associação explícita aos cartões físicos; não há backfill automático nem exclusão de histórico.

## Aplicação e testes

Não aplicar migrations a banco desconhecido. Conferir destino e revisar SQL antes de `npm run db:deploy`. Nenhuma migration é aplicada pelo servidor ao iniciar. O seed continua criando somente mesas fictícias; cartões são cadastrados no primeiro atendimento.

`npm test` executa testes HTTP e de validação sem banco. `RUN_MYSQL_TESTS=1 npm test` habilita o teste de integração (no PowerShell: `$env:RUN_MYSQL_TESTS='1'; npm test`). Usa credenciais locais de apps/api/.env, ou TEST_DATABASE_URL, para criar um banco efêmero de nome aleatório sprint01_test_*. Aplica as migrations apenas nele, testa concorrência, rollback, histórico e sessões e o remove ao terminar. Requer MySQL local e permissão para criar/remover esse banco; nunca aplica migrations ao banco indicado na URL. Em interrupção abrupta pode sobrar um banco com esse prefixo, a ser conferido antes de remoção manual.

## Telefone obrigatório — US-01

A migration incremental 20261003010000_cliente_telefone adiciona telefone VARCHAR(32). Novos cadastros pela API exigem nome, CPF e telefone. A coluna aceita NULL apenas para preservar registros anteriores sem inventar números; o serviço também rejeita telefone ausente ou vazio. Preenchimento de dados legados deve ser feito com informações reais fornecidas pelo cliente. As migrations anteriores permanecem intactas.
