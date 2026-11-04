# Arquitetura

Integração da Sprint 3: garçom recebe retirada e chamados pela mesma conexão SSE, mesa usa eventos autenticados por comanda e consulta extrato, administração gerencia categorias persistidas. Cozinha/bar e garçom reutilizam o serviço transacional de status.

## Decisão

Um repositório Git, npm workspaces, TypeScript, um backend Node/Express e um banco MySQL/Prisma. Apps React/Vite separados por público. Electron é apenas o shell desktop. Nenhum app acessa diretamente o banco nem importa o cliente Prisma.

```text
apps/recepcao ─┐
apps/mesa ─────┼── HTTP /api ── apps/api ── MySQL
apps futuros ─┘
```

A mesma API atende todos os dispositivos. No desenvolvimento cada integrante pode ter seu banco isolado; na demonstração integrada todos apontam para uma instância comum. Não executar um backend/banco independente por janela.

## Dependências

- Apps React → ui, api-client, contracts.
- api-client → contracts.
- API → contracts, Prisma, módulos de negócio.
- ui e contracts não dependem de apps, Node, Prisma ou Electron.
- Nenhum app importa código interno de outro app.

Os pacotes internos exportam TypeScript, compilado pelo Vite/tsup dos consumidores; não precisam de builds próprios. Manter contratos sem segredos ou dependências de banco. Os DTOs não substituem validação de entrada no backend.

## Expansão

| App futuro | Dispositivo | Módulos de backend relacionados |
|---|---|---|
| garcom | Android | chamados, entregas, comandas |
| cozinha | PC/Electron | pedidos, preparo |
| bar | PC/Electron | pedidos, preparo |
| caixa | PC/Electron | pagamentos, encerramento |
| administracao | PC/Electron | produtos, categorias, relatórios, usuários |

### Apps atuais e preparação da Sprint 3 (Grupo 9)

`apps/mesa` consome cardápio e confirma pedidos; cada confirmação cria um Pedido novo na mesma comanda, e só seus itens novos são distribuídos. `apps/cozinha` e `apps/bar` consomem filas por SSE e atualizam itens na API; regras e verificações executadas estão em `docs/us-12-us-13.md`. A preparação das US-14 a US-19 e US-21, incluindo módulos futuros e decisões pendentes, está em `docs/sprint-03.md`. A API compartilhada mantém a fonte de verdade para pedidos, comanda, itens e autorizações.

`apps/garcom` é uma web app responsiva para celular, servida na rede local e preparada como PWA para hospedagem HTTPS. `apps/administracao` é uma janela Electron desktop. O garçom consome a API para chamados (US-18); os outros fluxos de Sprint 3 e a administração ainda são prévias visuais. Regras, decisões e contratos estão em `docs/sprint-03.md`. Os próximos workspaces devem seguir package, porta, CORS e Electron dos apps existentes. As rotas operacionais sem login exigem rede interna. O bridge permanece restrito e as permissões são negadas por padrão. As capturas em `screenshots/` são referências visuais.

Adicionar pasta com package.json em apps/; npm workspaces a reconhecerá. Reutilizar os pacotes compartilhados, registrar porta de desenvolvimento própria e origem CORS. Só acrescentar ao comando raiz `dev` quando fizer sentido executar junto. A distribuição por apps não é uma barreira de autorização: a API deverá verificar perfil de funcionário e sessão de cliente. Autenticação de funcionários ainda não foi implementada.

## Android

Electron não roda no Android. O app mesa será empacotado com Capacitor em sprint futura. Manter React responsivo e recursos de plataforma em `apps/mesa/src/platform`. Câmera exige adaptadores/permissões e testes reais. Não importar Electron em componentes React. No tablet compartilhado, sair da sessão não encerra a comanda; descartar token e dados do cliente anterior ao trocar usuário.

## Electron

Context isolation e sandbox ativos; Node desativado no renderer. Novas janelas e navegação externa bloqueadas. Permissões negadas por padrão. A US-06 deve permitir somente vídeo para a origem local do app mesa e tratar recusa de permissão. Recepção não precisa de câmera nesta base. A CSP permite conexões HTTP/HTTPS para API configurável e WebSocket de desenvolvimento; restringir à origem de implantação quando o ambiente de produção estiver definido.

## Fora da preparação

As nove rotas de negócio da sprint 1 estão implementadas com persistência MySQL, autorização por credencial de instalação e sessões temporárias. Contratos e limites estão em docs/contratos-api.md. Leitura da câmera, interfaces de negócio, login individual, Socket.IO, aplicativo Android e integração de pagamento continuam fora desta entrega de backend.
