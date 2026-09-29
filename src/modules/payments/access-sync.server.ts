/**
 * access-sync.server.ts — Recalcula (e grava) as matrículas de COMPRA e de ASSINATURA de um aluno.
 *
 * Quem chama: o processamento dos avisos do provedor, os pedidos de reembolso, o cancelamento de
 * assinatura e o painel (ao mudar os cursos incluídos na assinatura).
 *
 * Passos (sempre dentro de UMA transação, com a trava do aluno):
 *  1. Trava o aluno: dois avisos do mesmo aluno ao mesmo tempo não se atropelam.
 *  2. Busca os pedidos PAGOS e os ciclos PAGOS da assinatura (os estornados/contestados já não
 *     contam — o status deles mudou antes desta chamada).
 *  3. Calcula o que as matrículas deveriam ser (`access-sync.ts`, regras puras e testadas).
 *  4. Grava só as diferenças: cria/atualiza/revoga as linhas PURCHASE e SUBSCRIPTION.
 * A matrícula MANUAL nunca é tocada aqui.
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { EnrollmentSource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { advisoryLock } from "@/lib/db-locks";

import {
  computePurchaseAccess,
  computeSubscriptionAccess,
  computeSubscriptionTargets,
  planAccessChanges,
  type AccessChanges,
} from "./access-sync";

type Tx = Prisma.TransactionClient;

const rowSelect = { courseId: true, startsAt: true, expiresAt: true, revokedAt: true } as const;

async function applyChanges(tx: Tx, userId: string, source: EnrollmentSource, changes: AccessChanges, now: Date) {
  for (const { courseId, period } of changes.upserts) {
    await tx.enrollment.upsert({
      where: { userId_courseId_source: { userId, courseId, source } },
      create: { userId, courseId, source, ...period },
      update: { ...period, revokedAt: null },
    });
  }
  if (changes.revokes.length > 0) {
    await tx.enrollment.updateMany({
      where: { userId, source, courseId: { in: changes.revokes }, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}

export type AccessSyncResult = { purchase: AccessChanges; subscription: AccessChanges };

/** Recalcula o acesso pago do aluno. Precisa ser chamada DENTRO de uma transação. */
export async function syncPaidAccess(tx: Tx, userId: string, now: Date): Promise<AccessSyncResult> {
  await advisoryLock(tx, `access:${userId}`);

  // Compras avulsas: pedidos pagos, com a "foto" dos cursos e dos dias comprados.
  const paidOrders = await tx.order.findMany({
    where: { userId, status: "PAID", paidAt: { not: null } },
    select: { paidAt: true, accessDays: true, courses: { select: { courseId: true } } },
  });
  const purchaseTargets = computePurchaseAccess(
    paidOrders.map((order) => ({
      paidAt: order.paidAt as Date,
      accessDays: order.accessDays,
      courseIds: order.courses.map((item) => item.courseId),
    })),
  );
  const purchaseRows = await tx.enrollment.findMany({ where: { userId, source: "PURCHASE" }, select: rowSelect });
  const purchase = planAccessChanges(purchaseRows, purchaseTargets);
  await applyChanges(tx, userId, "PURCHASE", purchase, now);

  // Assinatura: ciclos pagos (mesmo de uma assinatura já cancelada: o período pago continua valendo).
  const paidCycles = await tx.payment.findMany({
    where: { subscription: { userId }, status: { in: ["CONFIRMED", "RECEIVED"] }, paidAt: { not: null } },
    select: { paidAt: true, dueDate: true, subscription: { select: { cycle: true } } },
  });
  const period = computeSubscriptionAccess(
    paidCycles.map((cycle) => ({
      paidAt: cycle.paidAt as Date,
      dueDate: cycle.dueDate,
      cycle: cycle.subscription?.cycle ?? "MONTHLY",
    })),
  );
  const included = await tx.course.findMany({ where: { includedInSubscription: true }, select: { id: true } });
  const subscriptionRows = await tx.enrollment.findMany({ where: { userId, source: "SUBSCRIPTION" }, select: rowSelect });
  const subscriptionTargets = computeSubscriptionTargets({
    period,
    includedCourseIds: included.map((course) => course.id),
    existingRows: subscriptionRows,
  });
  const subscription = planAccessChanges(subscriptionRows, subscriptionTargets);
  await applyChanges(tx, userId, "SUBSCRIPTION", subscription, now);

  return { purchase, subscription };
}

/** O mesmo, abrindo a própria transação (para quem não está dentro de uma). */
export async function syncPaidAccessForUser(userId: string, now: Date = new Date()): Promise<AccessSyncResult> {
  return prisma.$transaction((tx) => syncPaidAccess(tx, userId, now), { timeout: 15_000 });
}

/**
 * Recalcula todos os assinantes (quem tem algum ciclo pago). Usada quando o painel muda os
 * cursos incluídos na assinatura: quem está com a assinatura em dia ganha o curso novo na hora
 * (e um curso retirado deixa de ganhar mais tempo). Um aluno por vez (transações curtas).
 */
export async function syncAllSubscribers(now: Date = new Date()): Promise<number> {
  const subscribers = await prisma.subscription.findMany({
    where: { payments: { some: { status: { in: ["CONFIRMED", "RECEIVED"] } } } },
    select: { userId: true },
    distinct: ["userId"],
  });
  for (const { userId } of subscribers) {
    await syncPaidAccessForUser(userId, now);
  }
  return subscribers.length;
}
