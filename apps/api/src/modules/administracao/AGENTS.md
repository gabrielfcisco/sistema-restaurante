# Categorias — US-19

API comum, sem login, somente na rede interna. IDs de categorias são textos estáveis; nome editável obrigatório e aparado, com unicidade protegida pela collation `utf8mb4_unicode_ci` no banco. Não excluir categorias/produtos/histórico. Inativação deve continuar impedindo catálogo e confirmação de novos itens. Preserve a serialização com a confirmação de pedidos.

Sprint 4: US-20/26 acrescentarão setor/cadastro de produtos neste módulo quando solicitadas. Ler `docs/sprint-04.md` na raiz. Usar campos existentes de Produto e Categoria; alinhar DTOs e validação entre as histórias. Não incluir upload nem edição de preço da US-27. Bloquear alteração de setor com itens ainda não entregues, conforme decisão do responsável, incluindo proteção contra confirmação concorrente de pedidos.
