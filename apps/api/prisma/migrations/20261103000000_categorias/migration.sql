-- Preserva as chaves existentes e todo o histórico de produtos/pedidos.
CREATE TABLE `categoria` (
  `id_categoria` VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nome` VARCHAR(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ativo` BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (`id_categoria`),
  UNIQUE INDEX `uq_categoria_nome` (`nome`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO `categoria` (`id_categoria`, `nome`) VALUES
  ('PRATO', 'PRATO'), ('SOBREMESA', 'SOBREMESA'), ('BEBIDA', 'BEBIDA');
ALTER TABLE `produto` MODIFY `categoria` VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE `produto` ADD CONSTRAINT `produto_categoria_fkey` FOREIGN KEY (`categoria`)
  REFERENCES `categoria` (`id_categoria`) ON DELETE RESTRICT ON UPDATE CASCADE;
