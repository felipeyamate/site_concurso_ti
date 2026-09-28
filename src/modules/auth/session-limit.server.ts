/**
 * session-limit.server.ts — Aplica o limite de sessões no banco de dados.
 *
 * Quem chama: o hook `databaseHooks.session.create.after` em `auth.ts`, logo após cada login.
 * O que faz: busca as sessões do usuário, pergunta à regra (`selectSessionsToRevoke`) quais
 * sobram e apaga essas do banco. Apagar a sessão = deslogar aquele dispositivo.
 * O que devolve: quantas sessões foram removidas (útil nos testes e em logs).
 */
import "server-only";

import { prisma } from "@/lib/db";

import { MAX_ACTIVE_SESSIONS, selectSessionsToRevoke } from "./session-limit";

export async function enforceSessionLimit(userId: string, newSessionId: string): Promise<number> {
  // 1. Busca só os campos necessários de todas as sessões do usuário.
  const sessions = await prisma.session.findMany({
    where: { userId },
    select: { id: true, createdAt: true, expiresAt: true },
  });

  // 2. Decide quais remover (regra pura, testada separadamente).
  const idsToRevoke = selectSessionsToRevoke(sessions, {
    maxActiveSessions: MAX_ACTIVE_SESSIONS,
    now: new Date(),
    keepSessionId: newSessionId,
  });

  if (idsToRevoke.length === 0) {
    return 0;
  }

  // 3. Remove. O filtro por `userId` é uma segurança extra: nunca apaga sessão de outra pessoa.
  const { count } = await prisma.session.deleteMany({
    where: { id: { in: idsToRevoke }, userId },
  });
  return count;
}
