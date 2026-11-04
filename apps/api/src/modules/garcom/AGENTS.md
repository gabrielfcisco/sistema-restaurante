# Garçom — US-15 e US-17

Rotas sem login, somente na rede interna. Reutilize `operacao/service.ts` e `FilaFeed` para retirada/entrega; não duplique transições. Consulta por número de mesa não confunde número com ID interno. Retorne todas as comandas ativas, sem dados pessoais. Valores usam Decimal e incluem todos os itens confirmados, em qualquer status. Não adicionar chamadas (US-18) ou extrato do cliente (US-21).
