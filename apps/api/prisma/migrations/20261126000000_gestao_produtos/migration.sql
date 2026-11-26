ALTER TABLE produto
 ADD COLUMN imagem_path VARCHAR(255) NULL,
 ADD COLUMN excluido_em DATETIME(3) NULL;
ALTER TABLE item_pedido
 ADD COLUMN nome_produto VARCHAR(120) NULL,
 ADD COLUMN preco_unitario DECIMAL(10,2) NULL;
-- Preserva os valores disponíveis antes de permitir edições no cadastro.
UPDATE item_pedido i JOIN produto p ON p.id_produto = i.id_produto
 SET i.nome_produto = p.nome, i.preco_unitario = p.preco;
