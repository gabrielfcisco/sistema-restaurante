-- Incremental: mantém QR e atendimentos históricos; não converte códigos antigos implicitamente.
ALTER TABLE `mesa` MODIFY `status` ENUM('LIVRE','OCUPADA','RESERVADA','MANUTENCAO') NOT NULL DEFAULT 'LIVRE';
CREATE TABLE `cartao` (
  `id_cartao` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo` CHAR(5) NOT NULL,
  PRIMARY KEY (`id_cartao`), UNIQUE INDEX `uq_cartao_codigo` (`codigo`),
  CONSTRAINT `ck_cartao_codigo` CHECK (`codigo` REGEXP '^[0-9]{5}$')
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `comanda`
  MODIFY `qr_code` VARCHAR(255) NULL,
  ADD `id_cartao` INTEGER UNSIGNED NULL,
  ADD `chave_abertura` VARCHAR(128) NULL,
  ADD `hash_abertura` CHAR(64) NULL,
  ADD UNIQUE INDEX `uq_comanda_chave_abertura` (`chave_abertura`),
  ADD CONSTRAINT `comanda_id_cartao_fkey` FOREIGN KEY (`id_cartao`) REFERENCES `cartao` (`id_cartao`) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE `vinculo_cartao` (
  `id_cartao` INTEGER UNSIGNED NOT NULL,
  `id_comanda` INTEGER UNSIGNED NOT NULL,
  PRIMARY KEY (`id_cartao`), UNIQUE INDEX `uq_vinculo_comanda` (`id_comanda`),
  CONSTRAINT `vinculo_cartao_id_cartao_fkey` FOREIGN KEY (`id_cartao`) REFERENCES `cartao` (`id_cartao`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `vinculo_cartao_id_comanda_fkey` FOREIGN KEY (`id_comanda`) REFERENCES `comanda` (`id_comanda`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `sessao_mesa` (
  `token_hash` CHAR(64) NOT NULL,
  `id_comanda` INTEGER UNSIGNED NOT NULL,
  `expira_em` DATETIME(3) NOT NULL,
  `revogada_em` DATETIME(3) NULL,
  PRIMARY KEY (`token_hash`), INDEX `sessao_mesa_id_comanda_idx` (`id_comanda`),
  CONSTRAINT `sessao_mesa_id_comanda_fkey` FOREIGN KEY (`id_comanda`) REFERENCES `comanda` (`id_comanda`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
