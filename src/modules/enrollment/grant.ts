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
 */
import type { EnrollmentSource, PrismaClient } from "@/generated/prisma/client";

import { computeEnrollmentRenewal, type EnrollmentPeriod } from "./renewal";

// Só a parte do cliente que usamos: funciona com o cliente normal e dentro de transações.
type EnrollmentDb = Pick<PrismaClient, "enrollment">;

export async function grantEnrollment(
  db: EnrollmentDb,
  params: {
    userId: string;
    courseId: string;
    days: number | null; // null = sem data de fim
    now: Date;
    source?: EnrollmentSource;
  },
): Promise<{ renewed: boolean; period: EnrollmentPeriod }> {
  const where = { userId_courseId: { userId: params.userId, courseId: params.courseId } };
  const existing = await db.enrollment.findUnique({
    where,
    select: { startsAt: true, expiresAt: true, revokedAt: true },
  });
  const period = computeEnrollmentRenewal(existing, { days: params.days, now: params.now });

  // upsert = cria se não existe; se existe, renova (como o `update_or_create` do Django).
  await db.enrollment.upsert({
    where,
    create: { userId: params.userId, courseId: params.courseId, source: params.source ?? "MANUAL", ...period },
    update: { ...period, revokedAt: null },
  });
  return { renewed: Boolean(existing), period };
}

/** Cancela o acesso (se ainda não estava cancelado). Devolve `true` se havia o que cancelar. */
export async function revokeEnrollment(
  db: EnrollmentDb,
  params: { userId: string; courseId: string; now: Date },
): Promise<boolean> {
  const { count } = await db.enrollment.updateMany({
    where: { userId: params.userId, courseId: params.courseId, revokedAt: null },
    data: { revokedAt: params.now },
  });
  return count > 0;
}
