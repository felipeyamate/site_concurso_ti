/**
 * cleanup.server.ts — Limpeza diária de registros vencidos que não servem mais para nada.
 *
 * Quem chama: a tarefa agendada /api/cron/limpeza (uma vez por dia, na Vercel). Os testes chamam direto.
 * O que apaga (todos já sem uso, só ocupando espaço — e alguns com IP/navegador, dado pessoal):
 *  - logins (sessões) vencidos há mais de 1 dia;
 *  - códigos de verificação/link mágico/redefinição de senha vencidos;
 *  - contadores de tentativas de login (proteção contra força bruta) parados há mais de 1 dia;
 *  - registros de acesso (Marco Civil) com mais de 6 meses — o prazo da lei já passou, e a LGPD pede
 *    para não guardar dado pessoal além do necessário (ver `privacy/access-log.ts`).
 * Nunca toca em dados de aluno, vendas ou avisos de pagamento.
 */
import "server-only";

import { prisma } from "@/lib/db";
import { accessLogCutoff } from "@/modules/privacy/access-log";

const DAY_MS = 24 * 60 * 60 * 1000;

export type CleanupResult = { sessions: number; verifications: number; rateLimits: number; accessLogs: number };

export async function cleanupExpiredRecords(now: Date = new Date()): Promise<CleanupResult> {
  const oneDayAgo = new Date(now.getTime() - DAY_MS);
  const [sessions, verifications, rateLimits, accessLogs] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: oneDayAgo } } }),
    prisma.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
    // `lastRequest` é guardado em milissegundos (como o `Date.now()`), por isso o BigInt.
    prisma.rateLimit.deleteMany({ where: { lastRequest: { lt: BigInt(oneDayAgo.getTime()) } } }),
    prisma.accessLog.deleteMany({ where: { createdAt: { lt: accessLogCutoff(now) } } }),
  ]);
  return { sessions: sessions.count, verifications: verifications.count, rateLimits: rateLimits.count, accessLogs: accessLogs.count };
}
