# Categorias — US-19

API comum, sem login, somente na rede interna. IDs de categorias são textos estáveis; nome editável obrigatório e aparado, com unicidade protegida pela collation `utf8mb4_unicode_ci` no banco. Não excluir categorias/produtos/histórico. Inativação deve continuar impedindo catálogo e confirmação de novos itens. Preserve a serialização com a confirmação de pedidos. Não adicionar administração de produtos ou upload.
