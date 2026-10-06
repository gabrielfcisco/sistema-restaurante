# Interfaces da sprint 01

Base: commit a5cd686 da branch feat/sprint-01-api, implementado por Felipe Amaral. Esta entrega integra recepção e mesa com esses contratos. O Figma informado não concedeu acesso ao plugin; o usuário autorizou continuar com as telas atuais. A fidelidade ao protótipo está pendente.

## Executar em desenvolvimento

Usar Node 24 LTS. Na raiz:

```sh
npm ci
npm run setup
npm run setup:sprint
```

setup:sprint gera credenciais aleatórias locais para a recepção e o dispositivo da mesa 1. Não sobrescreve configuração existente. Configure DATABASE_URL em apps/api/.env para um banco de desenvolvimento conhecido e vazio ou com migrations compatíveis. Revise o destino antes de executar:

```sh
npm run db:deploy
npm run db:seed
npm run dev
```

O seed cria seis mesas; não é necessário pré-cadastrar cartões: o código físico de cinco dígitos é cadastrado na abertura pela API do Felipe.

## Configuração desktop

As credenciais ficam em apps/recepcao/.desktop-config.json e apps/mesa/.desktop-config.json, ignorados pelo Git, e são lidas pelo processo principal Electron. Não são variáveis VITE, não são retornadas pelo preload nem incorporadas ao bundle React.

Formato de cada arquivo:

```json
{
  "apiUrl": "http://127.0.0.1:3333/api",
  "token": "<credencial do aplicativo autorizado>"
}
```

A recepção usa RECEPCAO_API_TOKEN do servidor. O dispositivo da mesa usa o token correspondente em MESA_DEVICE_TOKENS, por exemplo {"1":"<token do dispositivo>"}. ID interno da mesa é definido no servidor; o renderer não escolhe outra mesa. Para instalações já configuradas, crie os arquivos desktop manualmente usando as credenciais existentes.

Em apps empacotados, config.json fica no diretório userData do Electron. RESTAURANTE_CONFIG pode indicar um arquivo de provisionamento diferente. Para rodar em outro computador, configurar a URL da API; HTTPS é exigido para servidor fora de localhost. O bridge permite somente rotas próprias de cada aplicativo e verifica o frame de origem. Configuração inválida ou ausente bloqueia as operações.

Os arquivos de credenciais têm de permanecer no dispositivo autorizado. Esta sprint utiliza credenciais de instalação, conforme a API do Felipe; não adiciona login individual de funcionário. Restrinja os arquivos no sistema operacional. O renderer recebe somente respostas da API e tokens temporários de sessão.

## Demonstração

1. Na recepção, busque um CPF sintético válido. Se não existir, informe nome e telefone para cadastrar.
2. Escolha uma mesa livre ou reservada e digite os cinco dígitos do cartão físico, preservando zeros à esquerda.
3. Abra a comanda. O resumo mostra número, cliente, mesa e QR do código físico; Reexibir cartão recupera sua apresentação sem mudar o identificador.
4. No aplicativo da mesa autorizada, digite o código ou leia o QR pela webcam. Uma mesa diferente é recusada pelo servidor.
5. Sair / trocar cliente limpa imediatamente os dados locais e revoga a sessão. A comanda continua aberta.
6. Na recepção, escolha a mesma mesa e confirme a inclusão de outro cliente com outro cartão. Ver atendimentos mostra os vínculos ativos.
7. Reservar mesa muda o estado de uma mesa livre. Liberar mesa exige confirmação na interface, encerra todas as comandas, revoga sessões e libera cartões, preservando o histórico. Não registra pagamento.

Se a API cair, a interface mostra o erro. A sessão da mesa é revalidada a cada 15 segundos e expira no horário retornado pelo servidor; falha de conexão bloqueia a área identificada até reconectar. Tokens não são gravados no armazenamento do navegador. Ao recarregar ou fechar a janela, o acesso local é descartado. Webcam negada/ausente oferece entrada manual. Leitura real exige câmera e cartão em condições adequadas.

## Verificações

`npm run check`: lint, tipos, testes HTTP e transporte desktop, builds e validação Prisma.

`RUN_MYSQL_TESTS=1` e `TEST_DATABASE_URL`: habilitam os testes reais existentes do Felipe, agora incluindo revalidação de sessão. Os testes criam e removem um banco com nome aleatório reservado aos testes; exigem servidor local e credencial com autorização para criar banco.

`npm run test:desktop`: verifica interfaces compiladas com API real disponível. Requer configuração desktop da recepção e da mesa.

Cardápio e pedidos permanecem nas próximas sprints. Não há alteração de migrations nesta branch.


## Configurar a mesa por QR administrativo

Na tela de identificação do aplicativo Mesa, escaneie o QR físico com conteúdo exato `adm1234`. O formulário mostra o número atual e permite salvar outro número de mesa já cadastrado. Cancelar mantém a configuração anterior. Se houver um cliente identificado, use primeiro Sair / trocar cliente.

O vínculo é persistido na API por dispositivo (hash da credencial), em `dispositivo_mesa`. O número exibido é resolvido para o ID interno da mesa; os dois não precisam ser iguais. As próximas leituras de cartão são validadas contra esse vínculo. A configuração permanece após reiniciar a API ou o aplicativo. O QR administrativo só funciona em dispositivos já autorizados.

Antes de iniciar esta versão, aplique a migration `20261006000000_dispositivo_mesa` com `npm run db:deploy` no banco de desenvolvimento conferido e gere o cliente com `npm run db:generate`. Dispositivos ainda não configurados usam a mesa inicial de `MESA_DEVICE_TOKENS`.

A recepção usa apenas o cartão físico existente: após abrir a comanda, confira cliente, mesa e código do cartão e use Próximo cliente. Não há geração nem reexibição de QR nessa tela.
