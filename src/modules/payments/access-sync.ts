/**
 * access-sync.ts — Calcula as matrículas de COMPRA e de ASSINATURA a partir dos pagamentos.
 *
 * Quem chama: `access-sync.server.ts`, toda vez que um pagamento do aluno muda (aviso do
 * provedor, pedido de reembolso, curso incluído na assinatura...).
 *
 * A ideia central da Fase 4: a matrícula paga NÃO é "somada/subtraída" a cada aviso. Ela é
 * RECALCULADA do zero a partir da lista de pagamentos válidos (pagos e não estornados):
 *  - processar o mesmo aviso duas vezes dá o mesmo resultado (idempotente, de graça);
 *  - um reembolso tira exatamente o que aquele pagamento tinha dado, nem mais nem menos;
 *  - a matrícula MANUAL (outra linha) nunca é tocada.
 * Paralelo em Python: é como recalcular um saldo com `sum(...)` sobre os lançamentos, em vez de
 * guardar um contador que você incrementa e decrementa (e que se perde se um passo falhar).
 *
 * Arquivo "puro" (sem banco), testado em `access-sync.test.ts`.
 */
import type { PlanCycle } from "@/generated/prisma/enums";
import type { EnrollmentSnapshot } from "@/modules/enrollment/access";
import { computeEnrollmentRenewal, type EnrollmentPeriod } from "@/modules/enrollment/renewal";

import { utcToDateOnly } from "./dates";
import { subscriptionPeriodEnd } from "./rules";

// Um pedido pago e válido (não estornado), com a "foto" dos cursos e dos dias comprados.
export type AccessOrder = { paidAt: Date; accessDays: number | null; courseIds: string[] };

/**
 * Período de acesso de cada curso comprado.
 * Aplica, compra a compra NA ORDEM EM QUE FORAM PAGAS, a mesma regra de renovação da matrícula
 * manual (`computeEnrollmentRenewal`): recomprar com o acesso ativo SOMA os dias; recomprar
 * depois de vencido recomeça do dia do pagamento.
 */
export function computePurchaseAccess(orders: AccessOrder[]): Map<string, EnrollmentPeriod> {
  const sorted = [...orders].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
  const periods = new Map<string, EnrollmentPeriod>();
  for (const order of sorted) {
    for (const courseId of order.courseIds) {
      const previous = periods.get(courseId);
      const snapshot: EnrollmentSnapshot | null = previous ? { ...previous, revokedAt: null } : null;
      periods.set(courseId, computeEnrollmentRenewal(snapshot, { days: order.accessDays, now: order.paidAt }));
    }
  }
  return periods;
}

// Um ciclo pago e válido da assinatura. `dueDate` = coluna de data do banco (meia-noite UTC).
export type AccessSubscriptionPayment = { paidAt: Date; dueDate: Date; cycle: PlanCycle };

/**
 * Período liberado pela assinatura: do 1º pagamento até o fim do ciclo pago mais distante
 * (+ tolerância — ver `subscriptionPeriodEnd`). `null` = nenhum ciclo pago válido.
 */
export function computeSubscriptionAccess(payments: AccessSubscriptionPayment[]): EnrollmentPeriod | null {
  if (payments.length === 0) return null;
  let startsAt = payments[0].paidAt;
  let expiresAt = subscriptionPeriodEnd(utcToDateOnly(payments[0].dueDate), payments[0].cycle);
  for (const payment of payments.slice(1)) {
    if (payment.paidAt < startsAt) startsAt = payment.paidAt;
    const end = subscriptionPeriodEnd(utcToDateOnly(payment.dueDate), payment.cycle);
    if (end > expiresAt) expiresAt = end;
  }
  return { startsAt, expiresAt };
}

// Uma matrícula (de compra ou de assinatura) que já está no banco.
export type ExistingAccessRow = { courseId: string } & EnrollmentSnapshot;

/**
 * Quais cursos a assinatura deve liberar, e até quando.
 *  - Cursos INCLUÍDOS na assinatura hoje: o período da assinatura (ou nada, se não há ciclo pago).
 *  - Cursos que JÁ tinham matrícula da assinatura mas saíram dela: continuam até o fim do que já
 *    tinham (nunca ganham mais tempo) — e perdem o acesso se o pagamento for estornado.
 *    Se aquela matrícula já estava revogada, fica como está.
 */
export function computeSubscriptionTargets(input: {
  period: EnrollmentPeriod | null;
  includedCourseIds: string[];
  existingRows: ExistingAccessRow[];
}): Map<string, EnrollmentPeriod> {
  const targets = new Map<string, EnrollmentPeriod>();
  if (!input.period) return targets;
  const period = input.period;

  for (const courseId of input.includedCourseIds) {
    targets.set(courseId, period);
  }
  const included = new Set(input.includedCourseIds);
  for (const row of input.existingRows) {
    if (included.has(row.courseId) || row.revokedAt) continue;
    const expiresAt =
      row.expiresAt === null || period.expiresAt === null
        ? (row.expiresAt ?? period.expiresAt)
        : new Date(Math.min(row.expiresAt.getTime(), period.expiresAt.getTime()));
    targets.set(row.courseId, { startsAt: row.startsAt, expiresAt });
  }
  return targets;
}

export type AccessChanges = {
  // Criar ou atualizar a matrícula com este período (e tirar a revogação, se houver).
  upserts: Array<{ courseId: string; period: EnrollmentPeriod }>;
  // Revogar (o acesso daquela origem acabou: estorno, contestação...).
  revokes: string[];
};

/**
 * Compara o que está no banco com o que deveria estar e devolve só as MUDANÇAS
 * (assim, recalcular sem nada novo não grava nada).
 */
export function planAccessChanges(existingRows: ExistingAccessRow[], targets: Map<string, EnrollmentPeriod>): AccessChanges {
  const changes: AccessChanges = { upserts: [], revokes: [] };
  const existingByCourse = new Map(existingRows.map((row) => [row.courseId, row]));

  for (const [courseId, period] of targets) {
    const row = existingByCourse.get(courseId);
    const same =
      row &&
      !row.revokedAt &&
      row.startsAt.getTime() === period.startsAt.getTime() &&
      (row.expiresAt?.getTime() ?? null) === (period.expiresAt?.getTime() ?? null);
    if (!same) changes.upserts.push({ courseId, period });
  }
  for (const row of existingRows) {
    if (!targets.has(row.courseId) && !row.revokedAt) changes.revokes.push(row.courseId);
  }
  return changes;
}
