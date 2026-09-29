/**
 * grant.ts — Matricular (criar/renovar) e revogar matrículas no banco.
 *
 * Quem chama: o painel admin (/admin/usuarios/[id], só ADMIN), o script `npm run enroll` e, na
 * Fase 4, o webhook de pagamento confirmado. Todos usam ESTAS funções — a regra é uma só.
 *
 * Recebe o cliente do banco por parâmetro (em vez de importar `@/lib/db`) porque os scripts de
 * terminal têm a sua própria conexão (`scripts/script-db.ts`). Paralelo em Python: passar a
 * `session` do SQLAlchemy para a função, em vez de a função abrir uma.
 *
 * Regras (ver `renewal.ts`): uma matrícula por aluno e curso; renovar nunca tira dias;
 * vencida/revogada recomeça agora; a origem (MANUAL/compra/assinatura) existente é mantida;
 * revogar não apaga a linha (marca `revokedAt`, para ficar o histórico).
 *
 * Por que uma "trava" (lock) por aluno+curso: renovar é "ler a data atual → somar os dias →
 * gravar". Se dois pedidos chegassem juntos (dois cliques, ou o webhook da Fase 4 junto com o
 * painel), os dois leriam a MESMA data e um dos acréscimos se perderia (+30 e +30 = só +30).
 * Com a trava, o segundo pedido espera o primeiro terminar e lê a data já renovada.
 * Paralelo em Python: um `threading.Lock` por chave — só que guardado no banco, então vale
 * também entre servidores diferentes.
 */
import type { EnrollmentSource, Prisma, PrismaClient } from "@/generated/prisma/client";

import { computeEnrollmentRenewal, type EnrollmentPeriod } from "./renewal";

type Tx = Prisma.TransactionClient;

/**
 * Trava as matrículas deste aluno neste curso até o fim da transação.
 * `pg_advisory_xact_lock` é uma trava do PostgreSQL identificada por um número (aqui, o "hash" de
 * aluno+curso); ela vale mesmo quando a matrícula ainda não existe e se solta sozinha no fim.
 */
async function lockEnrollment(tx: Tx, userId: string, courseId: string): Promise<void> {
  const lockKey = `enrollment:${userId}:${courseId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
}

export async function grantEnrollment(
  db: PrismaClient,
  params: {
    userId: string;
    courseId: string;
    days: number | null; // null = sem data de fim
    now: Date;
    source?: EnrollmentSource;
  },
): Promise<{ renewed: boolean; period: EnrollmentPeriod }> {
  const where = { userId_courseId: { userId: params.userId, courseId: params.courseId } };
  return db.$transaction(async (tx) => {
    await lockEnrollment(tx, params.userId, params.courseId);
    const existing = await tx.enrollment.findUnique({
      where,
      select: { startsAt: true, expiresAt: true, revokedAt: true },
    });
    const period = computeEnrollmentRenewal(existing, { days: params.days, now: params.now });

    // upsert = cria se não existe; se existe, renova (como o `update_or_create` do Django).
    await tx.enrollment.upsert({
      where,
      create: { userId: params.userId, courseId: params.courseId, source: params.source ?? "MANUAL", ...period },
      update: { ...period, revokedAt: null },
    });
    return { renewed: Boolean(existing), period };
  });
}

/**
 * Cancela o acesso (se ainda não estava cancelado). Devolve `true` se havia o que cancelar.
 * Usa a mesma trava: uma renovação em andamento nunca "desfaz" um cancelamento feito ao mesmo tempo.
 */
export async function revokeEnrollment(
  db: PrismaClient,
  params: { userId: string; courseId: string; now: Date },
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    await lockEnrollment(tx, params.userId, params.courseId);
    const { count } = await tx.enrollment.updateMany({
      where: { userId: params.userId, courseId: params.courseId, revokedAt: null },
      data: { revokedAt: params.now },
    });
    return count > 0;
  });
}
