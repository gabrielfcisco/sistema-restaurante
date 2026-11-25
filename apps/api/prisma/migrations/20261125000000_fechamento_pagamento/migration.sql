ALTER TABLE comanda
 ADD COLUMN forma_pagamento ENUM('DINHEIRO','PIX','DEBITO','CREDITO') NULL,
 ADD COLUMN fechamento_solicitado_em DATETIME(3) NULL;
CREATE TABLE preconta (
 id_preconta INT UNSIGNED NOT NULL AUTO_INCREMENT,
 id_comanda INT UNSIGNED NOT NULL,
 criada_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 documento JSON NOT NULL,
 PRIMARY KEY (id_preconta), INDEX ix_preconta_comanda (id_comanda),
 CONSTRAINT fk_preconta_comanda FOREIGN KEY (id_comanda) REFERENCES comanda(id_comanda) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE cobranca (
 id_cobranca INT UNSIGNED NOT NULL AUTO_INCREMENT,
 id_preconta INT UNSIGNED NOT NULL,
 criada_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 concluida_em DATETIME(3) NULL,
 PRIMARY KEY (id_cobranca), UNIQUE KEY uq_cobranca_preconta (id_preconta),
 CONSTRAINT fk_cobranca_preconta FOREIGN KEY (id_preconta) REFERENCES preconta(id_preconta) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE pagamento (
 id_pagamento INT UNSIGNED NOT NULL AUTO_INCREMENT,
 id_comanda INT UNSIGNED NOT NULL,
 id_preconta INT UNSIGNED NOT NULL,
 forma ENUM('DINHEIRO','PIX','DEBITO','CREDITO') NOT NULL,
 valor DECIMAL(14,2) NOT NULL,
 pago_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (id_pagamento), UNIQUE KEY uq_pagamento_comanda (id_comanda), UNIQUE KEY uq_pagamento_preconta (id_preconta),
 CONSTRAINT fk_pagamento_comanda FOREIGN KEY (id_comanda) REFERENCES comanda(id_comanda) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT fk_pagamento_preconta FOREIGN KEY (id_preconta) REFERENCES preconta(id_preconta) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
