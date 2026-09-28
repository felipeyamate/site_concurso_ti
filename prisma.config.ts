/**
 * prisma.config.ts — Configuração do CLI do Prisma (migrações, geração do cliente).
 *
 * Quem usa: os comandos `npx prisma ...` (ex.: `prisma migrate dev`, `prisma generate`).
 * O app em si NÃO lê este arquivo; o app conecta no banco via `src/lib/db.ts`.
 *
 * Paralelo em Python: é como o `alembic.ini` + `env.py` do Alembic — diz onde está o schema,
 * onde ficam as migrações e em qual banco aplicá-las.
 */
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// O Prisma 7 não lê arquivos .env sozinho. Carregamos na mesma ordem de prioridade do Next.js:
// primeiro `.env.local` (seus segredos, fora do Git), depois `.env` (se existir).
// Variáveis já definidas no sistema (ex.: na Vercel ou no CI) nunca são sobrescritas.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrações precisam de uma conexão DIRETA com o banco (sem o "pooler" da Neon),
    // porque usam travas (locks) que o pooler não suporta. Se DIRECT_URL não existir
    // (ex.: banco local), usamos a mesma DATABASE_URL do app.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
