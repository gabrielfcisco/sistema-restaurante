import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // O fallback permite gerar o client durante `npm install` sem acessar o banco.
    // Comandos de migration devem usar a DATABASE_URL real definida em .env.
    url:
      process.env.DATABASE_URL ??
      "mysql://usuario:senha@localhost:3306/gerenciamento_restaurante",
  },
});
