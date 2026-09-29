# Arquitetura

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

Adicionar pasta com package.json em apps/; npm workspaces a reconhecerá. Reutilizar os pacotes compartilhados, registrar porta de desenvolvimento própria e origem CORS. Só acrescentar ao comando raiz `dev` quando fizer sentido executar junto. A distribuição por apps não é uma barreira de autorização: a API deverá verificar perfil de funcionário e sessão de cliente. Autenticação de funcionários ainda não foi implementada.

## Android

Electron não roda no Android. O app mesa será empacotado com Capacitor em sprint futura. Manter React responsivo e recursos de plataforma em `apps/mesa/src/platform`. Câmera exige adaptadores/permissões e testes reais. Não importar Electron em componentes React. No tablet compartilhado, sair da sessão não encerra a comanda; descartar token e dados do cliente anterior ao trocar usuário.

## Electron

Context isolation e sandbox ativos; Node desativado no renderer. Novas janelas e navegação externa bloqueadas. Permissões negadas por padrão. A US-06 deve permitir somente vídeo para a origem local do app mesa e tratar recusa de permissão. Recepção não precisa de câmera nesta base. A CSP permite conexões HTTP/HTTPS para API configurável e WebSocket de desenvolvimento; restringir à origem de implantação quando o ambiente de produção estiver definido.

## Fora da preparação

Não há CRUD de negócio, leitura QR, login, autorização, Socket.IO, aplicativo Android ou integração de pagamento implementados. São entregas futuras; esta alteração estabelece ambiente e limites de módulos.
