-- CreateTable
CREATE TABLE `cliente` (
    `id_cliente` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `cpf` CHAR(11) NOT NULL,
    `nome` VARCHAR(120) NOT NULL,

    UNIQUE INDEX `uq_cliente_cpf`(`cpf`),
    PRIMARY KEY (`id_cliente`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `cliente`
    ADD CONSTRAINT `ck_cliente_cpf`
    CHECK (`cpf` REGEXP '^[0-9]{11}$');

-- CreateTable
CREATE TABLE `mesa` (
    `id_mesa` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `numero` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('LIVRE', 'OCUPADA') NOT NULL DEFAULT 'LIVRE',

    UNIQUE INDEX `uq_mesa_numero`(`numero`),
    PRIMARY KEY (`id_mesa`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `mesa`
    ADD CONSTRAINT `ck_mesa_numero`
    CHECK (`numero` > 0);

-- CreateTable
CREATE TABLE `produto` (
    `id_produto` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(120) NOT NULL,
    `descricao` VARCHAR(500) NULL,
    `preco` DECIMAL(10, 2) NOT NULL,
    `categoria` ENUM('PRATO', 'SOBREMESA', 'BEBIDA') NOT NULL,
    `setor` ENUM('COZINHA', 'BAR') NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id_produto`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `produto`
    ADD CONSTRAINT `ck_produto_preco`
    CHECK (`preco` >= 0);

-- CreateTable
CREATE TABLE `comanda` (
    `id_comanda` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `qr_code` VARCHAR(255) NOT NULL,
    `status` ENUM('ABERTA', 'EM_CONSUMO', 'CONTA_SOLICITADA', 'PAGA', 'FECHADA') NOT NULL DEFAULT 'ABERTA',
    `data_abertura` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `data_fechamento` DATETIME(0) NULL,
    `id_cliente` INTEGER UNSIGNED NOT NULL,
    `id_mesa` INTEGER UNSIGNED NOT NULL,

    UNIQUE INDEX `uq_comanda_qr_code`(`qr_code`),
    INDEX `ix_comanda_cliente`(`id_cliente`),
    INDEX `ix_comanda_mesa`(`id_mesa`),
    INDEX `ix_comanda_status`(`status`),
    PRIMARY KEY (`id_comanda`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `comanda`
    ADD CONSTRAINT `ck_comanda_datas`
    CHECK (`data_fechamento` IS NULL OR `data_fechamento` >= `data_abertura`);

-- CreateTable
CREATE TABLE `pedido` (
    `id_pedido` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `data_hora` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `status` VARCHAR(30) NOT NULL DEFAULT 'ABERTO',
    `id_comanda` INTEGER UNSIGNED NOT NULL,

    INDEX `ix_pedido_comanda`(`id_comanda`),
    INDEX `ix_pedido_status`(`status`),
    PRIMARY KEY (`id_pedido`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `pedido`
    ADD CONSTRAINT `ck_pedido_status`
    CHECK (CHAR_LENGTH(TRIM(`status`)) > 0);

-- CreateTable
CREATE TABLE `item_pedido` (
    `id_item` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `quantidade` INTEGER UNSIGNED NOT NULL,
    `observacao` VARCHAR(500) NULL,
    `status` ENUM('PENDENTE', 'EM_PREPARO', 'PRONTO', 'ENTREGUE') NOT NULL DEFAULT 'PENDENTE',
    `id_pedido` INTEGER UNSIGNED NOT NULL,
    `id_produto` INTEGER UNSIGNED NOT NULL,

    INDEX `ix_item_pedido_pedido`(`id_pedido`),
    INDEX `ix_item_pedido_produto`(`id_produto`),
    INDEX `ix_item_pedido_status`(`status`),
    PRIMARY KEY (`id_item`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `item_pedido`
    ADD CONSTRAINT `ck_item_pedido_quantidade`
    CHECK (`quantidade` > 0);

-- AddForeignKey
ALTER TABLE `comanda` ADD CONSTRAINT `fk_comanda_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `cliente`(`id_cliente`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comanda` ADD CONSTRAINT `fk_comanda_mesa` FOREIGN KEY (`id_mesa`) REFERENCES `mesa`(`id_mesa`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido` ADD CONSTRAINT `fk_pedido_comanda` FOREIGN KEY (`id_comanda`) REFERENCES `comanda`(`id_comanda`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_pedido` ADD CONSTRAINT `fk_item_pedido_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedido`(`id_pedido`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_pedido` ADD CONSTRAINT `fk_item_pedido_produto` FOREIGN KEY (`id_produto`) REFERENCES `produto`(`id_produto`) ON DELETE RESTRICT ON UPDATE CASCADE;
