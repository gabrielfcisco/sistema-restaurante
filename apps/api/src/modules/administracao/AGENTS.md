# Categorias — US-19

**Estado em 25/11/2026:** US-20/22/23/24/25/26 implementadas. O estado e contratos finais ao fim de `docs/sprint-04.md` (na raiz) prevalecem sobre as notas históricas de preparação abaixo. Preservar as regras e restrições de escopo.

API comum, sem login, somente na rede interna. IDs de categorias são textos estáveis; nome editável obrigatório e aparado, com unicidade protegida pela collation `utf8mb4_unicode_ci` no banco. Não excluir categorias/produtos/histórico. Inativação deve continuar impedindo catálogo e confirmação de novos itens. Preserve a serialização com a confirmação de pedidos.

Sprint 4: US-20/26 acrescentarão setor/cadastro de produtos neste módulo quando solicitadas. Ler `docs/sprint-04.md` na raiz. Usar campos existentes de Produto e Categoria; alinhar DTOs e validação entre as histórias. Não incluir upload nem edição de preço da US-27. Bloquear alteração de setor com itens ainda não entregues, conforme decisão do responsável, incluindo proteção contra confirmação concorrente de pedidos.

## Ajustes solicitados em 26/11/2026

O responsável autorizou edição completa e exclusão de produtos, envio de fotos, exclusão de categorias e consulta do histórico de pagamentos. Estas decisões substituem as restrições anteriores sobre esse escopo. ItemPedido preserva nome/preço no momento da confirmação; não voltar a recalcular pedidos pelo preço atual do cadastro. A migration incremental `20261126000000_gestao_produtos` registra os valores disponíveis dos itens existentes. Produtos excluídos ficam fora da gestão e do cardápio, mantendo relações históricas. Categorias com produtos vinculados não podem ser excluídas. Conta com consumo zero não pode ser solicitada, emitida ou paga.
