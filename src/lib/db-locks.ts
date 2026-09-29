/**
 * db-locks.ts — "Travas" (locks) do PostgreSQL identificadas por um texto.
 *
 * Quem chama: operações do tipo "lê → calcula → grava" que não podem rodar duas ao mesmo tempo
 * para a mesma coisa (renovar matrícula, recalcular o acesso de um aluno, aplicar o aviso de uma
 * cobrança, pedir uma nota fiscal).
 *
 * Como funciona: `pg_advisory_xact_lock` trava um NÚMERO (aqui, o "hash" do texto) até o fim da
 * transação. Quem pedir a mesma trava espera. Vale entre servidores diferentes (a trava fica no
 * banco) e se solta sozinha no fim da transação, mesmo se der erro.
 * Paralelo em Python: um `threading.Lock` por chave — só que compartilhado por todos os servidores.
 *
 * Sem `import "server-only"` de propósito: os scripts de terminal (`npm run enroll`) também usam.
 */
import type { Prisma } from "@/generated/prisma/client";

export async function advisoryLock(tx: Prisma.TransactionClient, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
