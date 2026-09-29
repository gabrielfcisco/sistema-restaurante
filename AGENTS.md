# Desenvolvimento do sistema de restaurante

Este repositório é um monorepo npm: apps/api, apps/recepcao, apps/mesa e packages compartilhados.
Leia README.md, docs/arquitetura.md e docs/sprint-01.md antes de alterar regras de negócio.
Use Node 24 LTS, TypeScript e npm. Execute npm run check após mudanças relevantes.
Preserve migrations existentes; crie novas migrations para alterações de banco. Não aplique migrations em banco desconhecido.
Frontend não importa Prisma, credenciais, Node ou Electron. Integrações de dispositivo ficam em adapters próprios.
Electron deve manter contextIsolation, sandbox e nodeIntegration: false.
Uma mesa admite várias comandas ativas; um cartão admite apenas uma. CPF e nome são os dados de cadastro.
Não implemente histórias fora da sprint 1–6 sem solicitação. Novos apps usam a mesma API e banco com autorização por função.
legacy/nextjs é referência histórica, excluída dos workspaces e verificações. Não desenvolver ali.
Interfaces e mensagens em português. Não incluir dados reais em seeds ou testes.
