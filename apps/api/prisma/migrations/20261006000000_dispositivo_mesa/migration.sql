CREATE TABLE `dispositivo_mesa` (
  `token_hash` CHAR(64) NOT NULL,
  `id_mesa` INTEGER UNSIGNED NOT NULL,
  PRIMARY KEY (`token_hash`),
  CONSTRAINT `dispositivo_mesa_id_mesa_fkey` FOREIGN KEY (`id_mesa`) REFERENCES `mesa` (`id_mesa`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
