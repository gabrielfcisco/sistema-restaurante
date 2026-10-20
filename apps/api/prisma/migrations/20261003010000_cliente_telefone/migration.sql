-- Telefone obrigatório para novos cadastros pela API.
-- NULL preserva clientes legados sem inventar dados de contato.
ALTER TABLE `cliente` ADD COLUMN `telefone` VARCHAR(32) NULL;
