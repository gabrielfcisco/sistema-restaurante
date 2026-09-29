# Banco existente e próxima migration

O schema e a migration inicial foram preservados em `apps/api/prisma`. Só mudou o destino do cliente gerado para `apps/api/src/generated/prisma`. Nenhum banco foi alterado pela reorganização.

O schema atual já contém Cliente, Mesa, Produto, Comanda, Pedido e ItemPedido. Mesa possui relação de um para muitos com Comanda, compatível com comandas individuais na mesma mesa.

## Trabalho da sprint

1. Criar entidade Cartao com número de exibição e identificador QR fixo não previsível.
2. Relacionar Comanda ao cartão para preservar histórico de utilizações.
3. Representar ocupação ativa do cartão com restrição única no banco (por exemplo, tabela de vínculo ativo com idCartao único). Apenas uma consulta antes do insert não protege contra concorrência.
4. Realizar abertura, vínculo do cartão e atualização de mesa numa transação. Manter reserva exclusiva do cartão até encerrar/devolver conforme fluxo futuro.
5. Acrescentar estados RESERVADA e MANUTENCAO da mesa em migration incremental, mantendo dados existentes.
6. Acrescentar dados fictícios de cartões no seed após a modelagem.

`Comanda.qrCode` ainda é obrigatório e único no schema histórico. Não simplesmente reutilizar o mesmo QR em múltiplas comandas: isso conflita com a restrição. Planejar transição/backfill para Cartao e, só após compatibilização dos dados, remover a dependência antiga em migration revisada. Não editar a migration inicial já versionada/aplicada.

Não há necessidade de preencher pedidos, pagamentos ou relatórios nesta sprint. O banco não tem entidades de chamados, funcionários, pagamentos ou categorias dinâmicas; esses ajustes entram quando os respectivos fluxos forem programados.

Antes de aplicar qualquer migration em banco com dados, conferir destino e revisar SQL/backfill. Banco local vazio pode ser preparado com db:deploy; um banco existente exige conferir o histórico de migrations.
