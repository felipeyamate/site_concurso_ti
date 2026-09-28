/**
 * script-db.ts — Conexão com o banco para os scripts de linha de comando (`scripts/`, `prisma/seed.ts`).
 *
 * Quem chama: `set-role.ts`, `enroll.ts` e o seed.
 * O que devolve: um PrismaClient pronto, lendo a DATABASE_URL do `.env.local`/`.env`.
 *
 * Por que não usar `src/lib/db.ts`: aquele arquivo é marcado `server-only` (só roda dentro do
 * Next.js). Scripts rodam direto no Node, com o `tsx`.
 *
 * Lembre de chamar `await prisma.$disconnect()` no fim do script (senão ele fica "pendurado").
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";

export function createScriptPrismaClient(): PrismaClient {
  loadEnv({ path: ".env.local", quiet: true });
  loadEnv({ path: ".env", quiet: true });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL não encontrada. Configure o arquivo .env.local.");
    process.exit(1);
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
