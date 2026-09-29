# Sprint 01 — US-01 a US-06

Escopo acordado: preparar recepção e acesso à mesa. Cinco integrantes, sem especialidades ou nomes definidos. O planejamento abaixo substitui critérios antigos incompatíveis com as decisões posteriores do projeto; a equipe deve registrar a versão no seu quadro.

## Regras consolidadas

- Cadastro com nome e CPF; buscar cadastro existente por CPF. Não exigir telefone.
- Cartões físicos pré-cadastrados, QR fixo, reutilizados em atendimentos diferentes. Não gerar QR por atendimento.
- Um cartão tem no máximo um vínculo ativo. Histórico não acompanha o próximo cliente.
- Uma mesa admite várias comandas individuais ativas. Mesa ocupada pode receber outro cliente, após confirmação explícita da recepção.
- Mapa: livre verde, reservada amarelo, ocupada vermelho; manutenção indisponível. Reserva aparece como estado, sem construir módulo completo de reservas.
- Política inicial de seleção: livre ou ocupada com confirmação; reservada/manutenção bloqueadas até regra específica de reserva.
- Ao trocar cliente no tablet, encerrar sessão de acesso, não comanda.
- No encerramento futuro, mesa só fica livre quando não restar atendimento ativo.

## Divisão

| Integrante | História e responsabilidade | Área principal | Revisão sugerida |
|---|---|---|---|
| 1 | US-01: busca/cadastro de cliente, validação CPF e duplicidade | API clientes + recepção cadastro | Integrante 2 |
| 2 | US-02/03: abertura atômica de atendimento e associação à mesa | API comandas + recepção abertura | Integrante 4 |
| 3 | US-04: mapa, estados e confirmação de mesa ocupada | API mesas + recepção mapa | Integrante 1 |
| 4 | US-05: cartão disponível, vínculo exclusivo, resolução do código | API cartões + seletor na recepção | Integrante 5 |
| 5 | US-06: identificação, câmera, código manual, sessão e saída | app mesa + integração API | Integrante 3 |

Integrante 4 implementa validação/resolução do cartão na API; integrante 5 consome e integra sessão no app. Integrantes 2 e 4 alinham transação de vínculo. Integrante 3 coordena o shell de navegação da recepção para evitar edições conflitantes em App.tsx. Cada integrante escreve os testes do comportamento entregue. Os que terminarem primeiro apoiam câmera e integração transacional.

## Aceite por história

- **US-01:** cliente novo é salvo; CPF existente recupera cadastro; campos inválidos são recusados também na API; duplicidade simultânea é tratada.
- **US-02:** comanda com identificador único, status inicial e cliente; repetição acidental não cria atendimento duplicado.
- **US-03:** cliente, cartão e mesa são vinculados numa operação consistente; mesa ocupada aceita outra comanda confirmada; mesa indisponível é recusada; duas requisições não usam o mesmo cartão.
- **US-04:** mapa exibe número, estado textual e cor; reflete vínculos após abertura; não depende só da cor; mostra contagem de comandas.
- **US-05:** recepção usa cartão existente disponível; cartão em uso é recusado; código resolve somente o atendimento ativo; histórico de outra utilização não aparece.
- **US-06:** QR pela webcam e entrada manual abrem acesso à comanda da mesa configurada; tratar cartão inexistente, sem atendimento, comanda encerrada, mesa incorreta, câmera negada e servidor indisponível; sair remove dados da sessão anterior.

Cardápio completo pertence à US-07 e seguintes. Nesta sprint, acesso validado pode levar a uma tela de atendimento identificado, sem simular pedidos funcionando.

## Sequência de integração

1. Revisar contratos e criar a migration incremental de cartões com regras do documento de banco.
2. Integrante 1 implementa clientes; 3 implementa mesas; 4 cartões; 2 prepara abertura; 5 prepara identificação usando mocks explicitamente limitados aos testes/desenvolvimento.
3. Integrar os caminhos reais antes do final da sprint; nunca marcar história pronta apenas por interface com mock.
4. Testar: duas pessoas na mesma mesa, dois cartões diferentes, duas comandas e sessões isoladas.
5. Testar concorrência no mesmo cartão, falha no vínculo e ausência de gravações parciais.

## Entrega de cada integrante

Branch por tarefa (`feat/us-01-clientes`, por exemplo), commits pequenos, revisão de colega e integração frequente. O responsável pela alteração de schema inclui migration e coordena o arquivo com os demais. Evitar cinco pessoas alterando o mesmo schema em paralelo sem combinar.

Antes de integrar: `npm run check`, testes dos critérios relevantes e demonstração do caminho real. Informar mudanças de contrato aos consumidores. A equipe inteira verifica o fluxo final, não apenas o integrante da mesa.
