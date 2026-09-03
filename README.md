This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Banco de dados

O projeto usa MySQL 8 com Prisma ORM. O modelo está em `prisma/schema.prisma`, e as alterações versionadas do banco ficam em `prisma/migrations`.

1. Crie um banco MySQL vazio chamado `gerenciamento_restaurante`.
2. Copie `.env.example` para `.env` e ajuste usuário, senha, host e porta.
3. Instale as dependências com `npm install`.
4. Aplique a migration com `npm run db:deploy`.

Durante o desenvolvimento, use `npm run db:migrate` após alterar o schema. Para inspecionar os dados pelo navegador, execute `npm run db:studio`.

O cliente compartilhado para Server Components, Route Handlers e Server Actions está disponível em `lib/prisma.ts`:

```ts
import { prisma } from "@/lib/prisma";
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
