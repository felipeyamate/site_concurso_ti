/**
 * db.ts — Conexão única com o banco de dados (cliente do Prisma).
 *
 * Quem chama: todo código de servidor que lê/grava no banco
 * (ex.: `import { prisma } from "@/lib/db"` e depois `prisma.user.findMany()`).
 * O que devolve: `prisma`, o cliente tipado gerado a partir de `prisma/schema.prisma`.
 *
 * Por que um arquivo só para isso: cada cliente abre um "pool" de conexões. Se cada arquivo
 * criasse o seu, o banco ficaria sem conexões livres. Aqui garantimos UMA instância.
 * (Paralelo em Python: é como criar o `engine` do SQLAlchemy uma única vez num módulo.)
 *
 * Detalhe do Prisma 7: ele conversa com o PostgreSQL através de um "driver adapter"
 * (`PrismaPg`, que usa o pacote `pg` — o equivalente ao `psycopg` do Python).
 */
import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Em desenvolvimento, o Next.js recarrega os arquivos a cada alteração ("hot reload").
// Sem este truque, cada recarga criaria um cliente novo e esgotaria as conexões.
// Guardamos a instância no objeto global, que sobrevive às recargas.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
