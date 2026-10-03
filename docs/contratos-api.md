# Contratos da API — Sprint 01

Base `/api`, JSON. Rotas organizadas em `apps/api/src/modules/{clientes,mesas,comandas,acessos}/routes.ts`, registradas por `sprint-routes.ts`. Autorização compartilhada em `autorizacao.ts` e transações em `sprint-service.ts`; DTOs em `packages/contracts/src/index.ts`. Não inclui interfaces, leitura da câmera, pedidos ou pagamento.

## Configuração e autorização

Rotas da recepção exigem `Authorization: Bearer <RECEPCAO_API_TOKEN>`. O token deve ser exclusivo e ter pelo menos 32 caracteres. É uma credencial de instalação para esta sprint, não um login individual de funcionário. Não a embutir em código-fonte ou arquivos VITE públicos; provisionar no dispositivo autorizado. Usar HTTPS fora de localhost.

`MESA_DEVICE_TOKENS` é um JSON que relaciona ID interno da mesa à credencial exclusiva do seu dispositivo. Exemplo estrutural: `{"8":"<segredo exclusivo de pelo menos 32 caracteres>"}`. Tokens reais nunca devem ser commitados. A falta de configuração bloqueia o acesso (503); credencial ausente ou incorreta retorna 401. Cada token deve usar caracteres alfanuméricos, ponto, sublinhado, til ou hífen.

O POST de acesso exige a credencial do dispositivo como Bearer. A mesa é obtida dessa configuração no servidor. O código físico de cinco dígitos, sozinho, não autoriza dispositivos desconhecidos. Limite de 10 tentativas por minuto por mesa, em memória nesta instância; ao escalar para múltiplas instâncias, compartilhar o limitador. DELETE usa o token da sessão, não a credencial de instalação.

## Rotas da recepção

| Método e rota | Entrada | Retorno |
|---|---|---|
| POST /clientes/busca | `{ cpf }` | 200 ClienteDto; 404 CLIENTE_INEXISTENTE |
| POST /clientes | `{ nome, cpf, telefone }` | 201 ClienteDto; 409 CPF_DUPLICADO |
| GET /mesas | Sem corpo | 200 MesaDto[] ordenada pelo número |
| GET /mesas/:idMesa | ID interno | 200 MesaDetalheDto, com todos os atendimentos ativos e CPF mascarado |
| POST /atendimentos | `{ idCliente, idMesa, codigoCartao, confirmarMesaOcupada? }` + cabeçalho Idempotency-Key | 201 AtendimentoDto; 200 ao repetir a mesma abertura |
| POST /mesas/:idMesa/reservar | ID interno | 200 MesaDto, estado RESERVADA |
| POST /mesas/:idMesa/liberar | ID interno | 200 `{ idMesa, status: "LIVRE", comandasEncerradas }` |

CPF aceita 11 dígitos ou a máscara completa e valida dígitos verificadores. Nome obrigatório, até 120 caracteres. Telefone obrigatório, texto não vazio de até 32 caracteres, com espaços externos removidos. Sem restrição adicional de DDD/país ou máscara nesta entrega. ClienteDto inclui telefone; cadastros legados podem retornar null. Código físico é string de exatamente cinco dígitos, preservando zeros à esquerda. O servidor não sorteia códigos: recebe o que já está impresso.

Idempotency-Key: gerar uma chave por intenção de abertura (por exemplo UUID), entre 16 e 128 caracteres alfanuméricos, hífen ou sublinhado. Reutilizar a mesma chave ao reenviar após timeout. Mesma chave e mesmos dados retornam a comanda anterior; dados diferentes retornam 409 CHAVE_REUTILIZADA. Mesmo após liberar a mesa, repetir essa chave não reabre atendimento; uma nova intenção exige nova chave. A resposta de replay reflete o estado atual da comanda original.

Abertura aceita mesa livre/reservada e muda para OCUPADA. Mesa ocupada requer `confirmarMesaOcupada: true`, inclusive se foi ocupada depois de carregar o mapa. Manutenção é bloqueada. Código inexistente é cadastrado na mesma transação; existente disponível é reutilizado; em uso retorna 409 CARTAO_EM_USO. O resumo não grava atendimento antes da confirmação.

Reserva somente de mesa LIVRE e sem comandas ativas; não inclui agenda, nome ou horário. Liberação fecha todas as comandas ABERTA/EM_CONSUMO/CONTA_SOLICITADA, registra fechamento, remove vínculos ativos de cartões, revoga sessões e deixa LIVRE. Repetir liberação em mesa livre é seguro. Reserva sem atendimento é simplesmente retirada. Manutenção é bloqueada. Não registra pagamento nem apaga histórico.

## Acesso na mesa

`POST /acessos/mesa`, Bearer do dispositivo, corpo `{ "codigoCartao": "58324" }`:

```json
{
  "token": "<token temporário>",
  "expiraEm": "2026-10-03T23:00:00.000Z",
  "idComanda": 1,
  "codigoCartao": "58324",
  "idMesa": 8,
  "numeroMesa": 8,
  "nomeCliente": "Cliente fictício"
}
```

Retorna 201. QR e digitação enviam o mesmo código. Se o corpo também enviar idMesa, ele precisa coincidir com a configuração do dispositivo; nunca define a autorização.

Bloqueios: 404 CARTAO_INEXISTENTE, 409 SEM_ATENDIMENTO, 409 COMANDA_ENCERRADA, 403 MESA_INCORRETA ou 409 MESA_INDISPONIVEL. Nenhum desses erros retorna nome, mesa de outro cliente ou token. A ausência de vínculo ativo sempre bloqueia acesso.

Token aleatório de 256 bits; somente SHA-256 é persistido. Expiração configurável por MESA_SESSION_SECONDS (padrão técnico 28800 segundos, 8 horas; intervalo 60–86400). Futuras rotas autenticadas por sessão devem conferir hash, expiração, revogação e vínculo ativo; não tratar o token como autorização permanente.

`DELETE /acessos/mesa`, Bearer da sessão: 204, revoga somente aquela sessão. Ausente/expirada/revogada: 401. O aplicativo limpa seus dados locais ao sair. Liberação da mesa revoga todas as sessões dos seus atendimentos.

## Erros e operação

Formato `{ "error": { "code": "CARTAO_EM_USO", "message": "Esta comanda física já está em uso." } }`.

400 entrada inválida; 401 credencial/sessão inválida; 403 mesa incorreta; 404 inexistente; 409 conflito; 429 excesso de tentativas; 503 indisponibilidade/configuração ausente. Erros inesperados retornam 500 sem stack trace. Respostas de negócio usam Cache-Control: no-store. Não registrar CPF, telefone, códigos ou tokens em logs.

Rotas técnicas públicas existentes: GET /health (processo), GET /ready (banco, 200/503).

Não há GET /cartoes/disponiveis: a recepção digita o código físico. Cancelamento individual, CRUD de mesas, login individual e demais sprints não foram adicionados.
