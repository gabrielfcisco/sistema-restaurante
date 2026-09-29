# Contratos da API

Base: `/api`. JSON. DTOs compartilhados em `packages/contracts/src/index.ts`.

## Implementados na preparação

| Método e rota | Resultado |
|---|---|
| GET /health | 200: status ok e identificação do serviço |
| GET /ready | 200 se consulta ao banco funcionar; 503 caso contrário |

## Propostos para implementação na sprint

Os endpoints abaixo **ainda não existem**. São um acordo inicial para dividir o desenvolvimento; mudanças precisam ser combinadas com consumidores.

| Método e rota | Entrada | Resposta / responsabilidade |
|---|---|---|
| POST /clientes/busca | `{ cpf }` | ClienteDto ou 404; CPF no corpo para não constar na URL |
| POST /clientes | CriarClienteInput | 201 ClienteDto; 409 se CPF duplicado |
| GET /mesas | — | MesaDto[] com número de comandas ativas |
| GET /cartoes/disponiveis | — | CartaoDisponivelDto[]; não expor segredo do QR |
| POST /atendimentos | AbrirAtendimentoInput | 201 AtendimentoDto, após transação |
| POST /acessos/mesa | ValidarAcessoInput | SessaoMesaDto; sessão limitada a uma comanda/mesa |
| DELETE /acessos/mesa | Bearer token da sessão | 204; invalida acesso, sem fechar comanda |

US-02 e US-03 podem compartilhar uma confirmação e transação no backend. Não criar comanda sem mesa para depois tentar completar o vínculo, pois o schema exige mesa.

Formato de erro: `{ "error": { "code": "CARTAO_EM_USO", "message": "Cartão já está em uso." } }`.

Convenções propostas: 400 entrada inválida; 401 sessão ausente/inválida; 403 operação proibida; 404 recurso inexistente; 409 conflito de vínculo; 503 dependência indisponível. Não retornar stack trace, token do QR ou credenciais. CPF é dado pessoal: exibir mascarado nos resumos e não registrar em logs.

O backend valida todos os campos em runtime. Tipos TypeScript só ajudam em desenvolvimento. Código fixo do cartão é usado para obter sessão temporária; não usar número sequencial como autorização global nem permitir acesso a outras comandas. A identidade/configuração do dispositivo mesa e a autorização da recepção precisam ser verificadas no servidor, não apenas confiadas no idMesa enviado pela interface.

Autorização, expiração e revogação de sessão são tarefas de implementação: esta base não oferece segurança de produção por ter os apps em pastas separadas.
