CREATE TABLE `chamada` (
  `id_chamada` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_mesa` INTEGER UNSIGNED NOT NULL,
  `status` ENUM('PENDENTE','CONCLUIDA','CANCELADA') NOT NULL DEFAULT 'PENDENTE',
  `criada_em` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `finalizada_em` DATETIME(0) NULL,
  INDEX `ix_chamada_mesa_status` (`id_mesa`, `status`),
  INDEX `ix_chamada_status_criada` (`status`, `criada_em`),
  PRIMARY KEY (`id_chamada`),
  CONSTRAINT `fk_chamada_mesa` FOREIGN KEY (`id_mesa`) REFERENCES `mesa` (`id_mesa`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;