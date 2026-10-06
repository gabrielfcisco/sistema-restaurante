# Sprint 01 — Divisão do frontend entre cinco integrantes

A API da sprint 1 já está pronta. Este planejamento distribui somente as interfaces e o consumo dos endpoints existentes entre Felipe, Pedro Pimentel, Pedro Peruch, José e Gabriel. Não inclui implementação de backend, alterações de banco ou novas migrations.

As telas atuais servem de base: cada responsável revisa, organiza, completa e testa sua parte, aproveitando o que já funciona. As histórias US-01 a US-06 continuam no escopo, mas a divisão é por fluxo de interface para equilibrar o trabalho. A US-06 fica com duas pessoas porque envolve tanto câmera/identificação quanto sessão e troca de cliente.

## Divisão resumida

| Responsável | Frente de trabalho | Entrega principal | Revisão |
|---|---|---|---|
| Felipe | Recepção: busca e cadastro de clientes — US-01 | Cliente validado e selecionado para abrir atendimento | Pedro Pimentel |
| Pedro Pimentel | Recepção: cartão e abertura de comanda — US-02, US-03 e US-05 | Confirmar abertura e exibir resumo, código e QR do cartão | Pedro Peruch |
| Pedro Peruch | Recepção: mapa e gerenciamento de mesas — US-04 | Selecionar, consultar, reservar e liberar mesas | Felipe |
| José | Mesa: identificação por código e câmera — entrada da US-06 | Ler cartão e entregar a sessão retornada pela API | Gabriel |
| Gabriel | Mesa: atendimento identificado e sessão — continuidade da US-06 | Mostrar identificação, revalidar acesso e trocar cliente | José |

## Felipe — Busca e cadastro de clientes

**US-01 — Buscar e cadastrar cliente:** como recepcionista, quero buscar um cliente pelo CPF ou cadastrar nome, CPF e telefone para identificá-lo antes de abrir seu atendimento.

- Formulário de busca por CPF e tratamento de cliente não encontrado.
- Cadastro com nome, CPF e telefone obrigatórios, usando as validações compartilhadas já disponíveis.
- Mensagens de campos inválidos, CPF duplicado, carregamento e falha de conexão.
- Resumo do cliente selecionado e opção de iniciar atendimento de outro cliente, limpando os dados anteriores.
- Entregar o `ClienteDto` selecionado ao fluxo de abertura de Pedro Pimentel.
- Consumo existente: `POST /clientes/busca` e `POST /clientes`.
- Aceite: buscar cadastro existente, cadastrar cliente fictício, tratar erro de validação/duplicidade e continuar com o cliente correto.
- Branch sugerida: `feat/front-clientes`.

## Pedro Pimentel — Cartão e abertura de comanda

**US-02 — Abrir comanda:** como recepcionista, quero abrir uma comanda individual para o cliente selecionado e receber a confirmação da abertura.

**US-03 — Associar atendimento à mesa:** como recepcionista, quero vincular a comanda à mesa escolhida, podendo incluir outro cliente em mesa ocupada mediante confirmação.

**US-05 — Identificar o cartão físico:** como recepcionista, quero informar o código de cinco dígitos do cartão e visualizar seu código/QR vinculado ao atendimento, recebendo aviso se o cartão já estiver em uso.

- Entrada do código físico como texto de cinco dígitos, preservando zeros à esquerda, como `01234`.
- Resumo de cliente, mesa e cartão antes de confirmar; botão habilitado somente com dados válidos.
- Confirmação explícita para adicionar cliente a uma mesa ocupada e bloqueio de mesa em manutenção.
- Consumo da abertura existente, bloqueio de clique repetido e reutilização da chave de idempotência ao reenviar a mesma intenção após falha de conexão.
- Tratamento das respostas da API, incluindo cartão em uso e mudança de estado da mesa.
- Sucesso com número da comanda, cliente, mesa, código e QR correspondente ao cartão físico. Não criar código novo por atendimento.
- Ação de próximo cliente e aviso para atualizar o mapa após sucesso. Falha ao desenhar QR não deve esconder uma abertura concluída.
- Consumo existente: `POST /atendimentos`.
- Aceite: abrir comanda com cliente e mesa selecionados, tratar cartão em uso, preservar código com zero inicial e não duplicar abertura por clique/reenvio.
- Branch sugerida: `feat/front-abertura-comanda`.

## Pedro Peruch — Mapa e gerenciamento de mesas

**US-04 — Visualizar e gerenciar mesas:** como recepcionista, quero visualizar os estados e atendimentos das mesas, selecionar uma mesa, reservá-la ou liberá-la para organizar o salão.

- Cards com número, texto do estado, cor e quantidade de comandas; seleção visual e legenda acessível.
- Estados livre, reservada, ocupada e manutenção. Manutenção não pode ser selecionada para atendimento.
- Carregamento, lista vazia, erro e atualização do mapa, inclusive depois de uma abertura.
- Detalhe da mesa com atendimentos ativos, usando os dados e o CPF mascarado retornados pela API.
- Ações de reservar e liberar com confirmação clara de que liberar encerra todas as comandas e acessos da mesa, sem registrar pagamento.
- Entregar a mesa selecionada a Pedro Pimentel. A confirmação de adicionar cliente à ocupada pertence ao formulário de abertura, evitando duas confirmações iguais.
- Consumo existente: `GET /mesas`, `GET /mesas/:idMesa`, `POST /mesas/:idMesa/reservar` e `POST /mesas/:idMesa/liberar`.
- Aceite: selecionar mesa, consultar duas comandas na mesma mesa, reservar, cancelar a confirmação de liberação e confirmar liberação atualizando o mapa.
- Branch sugerida: `feat/front-mapa-mesas`.

## José — Identificação por código e câmera

**US-06 — Acessar atendimento na mesa (parte 1: identificação):** como cliente, quero escanear o QR do cartão ou digitar seu código para acessar meu atendimento na mesa correta.

- Tela inicial do app mesa com instruções e entrada manual de cinco dígitos.
- Leitura de QR usando o adaptador de câmera existente; iniciar, parar e liberar a câmera ao sair da tela.
- Estados de leitura/validação e prevenção de requisições duplicadas por leituras repetidas.
- Mensagens para permissão negada, câmera indisponível, código inválido, cartão inexistente/sem atendimento, mesa incorreta e servidor indisponível.
- Encaminhar tanto digitação quanto QR para o mesmo fluxo de acesso.
- Entregar o `SessaoMesaDto` retornado pela API ao componente coordenado por Gabriel; José não implementa revalidação periódica nem logout.
- Consumo existente: `POST /acessos/mesa`.
- Aceite: entrar por código e QR reais, tratar recusa de câmera oferecendo digitação e impedir acesso quando a API rejeitar o cartão.
- Branch sugerida: `feat/front-identificacao-mesa`.

## Gabriel — Atendimento identificado e ciclo da sessão

**US-06 — Acessar atendimento na mesa (parte 2: sessão):** como cliente, quero conferir minha identificação e comanda e sair do dispositivo sem encerrar meu atendimento, mantendo meus dados separados dos do próximo cliente.

José e Gabriel compartilham a mesma US-06; as duas partes são tarefas da história, não novas histórias. O aceite da US-06 depende da integração entre identificação e sessão.

- Tela de boas-vindas com nome, número da mesa, comanda e cartão após o acesso feito por José.
- Coordenar a alternância entre identificação e atendimento identificado no app mesa.
- Revalidar a sessão com a API e tratar expiração, revogação e indisponibilidade, aproveitando o comportamento existente.
- Ação de sair/trocar cliente: limpar dados locais e solicitar revogação, sem encerrar a comanda. Se a API estiver indisponível, limpar os dados locais e explicar que a revogação não foi confirmada.
- Cancelar timers e ignorar respostas antigas após saída ou troca de sessão.
- Ajustar a apresentação da tela de atendimento em janelas menores e estados de conexão, sem implementar cardápio ou pedidos.
- Consumo existente: `GET /acessos/mesa` e `DELETE /acessos/mesa`.
- Aceite: receber a sessão de José, exibir o cliente correto, reagir à expiração/liberação da mesa e trocar de cliente sem mostrar dados anteriores.
- Branch sugerida: `feat/front-sessao-mesa`.

## Organização dos arquivos e trabalho em paralelo

Hoje os fluxos estão concentrados em `apps/recepcao/src/Reception.tsx` e `apps/mesa/src/TableAccess.tsx`. Para evitar várias pessoas editando esses mesmos arquivos, combinar uma preparação pequena antes das mudanças paralelas: extrair os blocos existentes em componentes sem alterar o comportamento. A extração abaixo é uma tarefa planejada, não uma alteração já executada.

| Responsável | Componentes/áreas propostos |
|---|---|
| Felipe | `apps/recepcao/src/components/CadastroCliente.tsx` |
| Pedro Pimentel | `apps/recepcao/src/components/AberturaAtendimento.tsx` e `ResumoAtendimento.tsx`, incluindo cartão/QR |
| Pedro Peruch | `apps/recepcao/src/components/MapaMesas.tsx`, `DetalheMesa.tsx` e composição em `Reception.tsx` |
| José | `apps/mesa/src/components/IdentificacaoMesa.tsx`, `LeitorQr.tsx` e adaptador existente `platform/camera.ts` |
| Gabriel | `apps/mesa/src/components/AtendimentoIdentificado.tsx`, `hooks/useSessaoMesa.ts` e composição em `TableAccess.tsx` |

Pedro Peruch coordena a extração na recepção; Gabriel coordena a extração no app mesa. Os demais podem preparar cenários de teste e seus componentes enquanto essa base é integrada. Todos partem do mesmo commit combinado e incorporam a preparação antes de editar os blocos extraídos.

Combinar estas conexões entre componentes antes de começar:

- Cadastro comunica cliente selecionado/limpo à composição da recepção.
- Mapa comunica mesa selecionada; abertura recebe cliente e mesa e comunica sucesso para atualizar o mapa.
- Próximo cliente limpa cliente, seleção e resultado anterior pela composição da recepção.
- Identificação comunica a sessão válida ao app mesa; saída/expiração remove a sessão e retorna à identificação limpa.

Reutilizar `packages/ui`, `packages/contracts`, `packages/api-client` e a integração desktop existentes. Estilos específicos ficam junto da área de cada pessoa; alterações de estilos globais em `packages/ui` são combinadas com Pedro Peruch. Não colocar credenciais no React. Eventuais falhas da API são registradas separadamente, sem transformar esta divisão em cinco trabalhos de backend.

## Entrega e integração

Cada integrante entrega sua branch/PR, revisão pelo colega indicado, interface ligada à API real e demonstração curta de sucesso e erro. Testar carregamento, falha de conexão, navegação por teclado e prevenção de envios repetidos nas ações pertinentes. Usar dados fictícios; mocks servem para desenvolvimento e testes, não como evidência de integração pronta.

Executar `npm run check` antes de integrar e registrar os testes manuais da interface. Testes pulados não contam como aprovados. Não é necessário recriar funcionalidades que já estejam corretas: registrar o que foi revisado e o que foi complementado.

Demonstração conjunta:

1. Felipe busca ou cadastra um cliente.
2. Pedro Peruch seleciona uma mesa.
3. Pedro Pimentel informa cartão e abre a comanda.
4. José identifica o cartão no app mesa, por código e QR.
5. Gabriel mostra o atendimento e sai sem encerrar a comanda.
6. A equipe repete com outro cliente na mesma mesa, libera a mesa pela recepção e verifica que o acesso anterior perde validade e o cartão pode ser reutilizado sem dados antigos.

Fora da sprint: cardápio completo, pedidos, cozinha, pagamentos, Android e login individual de funcionários.
