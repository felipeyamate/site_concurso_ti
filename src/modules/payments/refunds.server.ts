/**
 * refunds.server.ts — Reembolso de compras e cancelamento de assinaturas.
 *
 * Quem chama: as Server Actions do aluno ("Pedir reembolso", "Cancelar assinatura") e do painel
 * (ADMIN). Os testes de integração chamam direto.
 *
 * Regras:
 *  - O ALUNO pede reembolso pelo site em até 7 dias depois do pagamento (direito de arrependimento).
 *    Na assinatura, vale para o 1º pagamento (e a assinatura é cancelada junto).
 *  - O ADMIN reembolsa a qualquer momento.
 *  - O acesso sai NA HORA do pedido (as cobranças viram "estorno em andamento"); a confirmação do
 *    provedor (aviso REFUNDED) chega depois. Se o provedor NEGAR o estorno, o acesso volta.
 *  - Boleto: o provedor precisa dos dados bancários do aluno para devolver; o estorno é feito à mão
 *    no painel do Asaas (o painel do site avisa quais estão pendentes).
 *  - Cancelar a assinatura: não gera novas cobranças; o período já pago continua valendo.
 *
 * Ordem dos passos: primeiro pedimos ao PROVEDOR; só se ele aceitar, gravamos aqui. Assim nunca
 * fica "reembolso pedido" no site sem o pedido de verdade no provedor.
 */
import "server-only";

import { prisma } from "@/lib/db";
import { advisoryLock } from "@/lib/db-locks";
import { UserFacingError } from "@/lib/form-state";

import { syncPaidAccess } from "./access-sync.server";
import { runEffects, type PaymentEffect } from "./effects.server";
import { dateToEventTime } from "./provider/asaas/mapping";
import { getProviderForRecord } from "./provider/provider.server";
import { PaymentProviderError } from "./provider/types";
import { checkRefundEligibility, deriveOrderStatus, isPaidStatus, isWithinRefundWindow } from "./rules";

export type Actor = { userId: string; isAdmin: boolean };

function providerMessage(error: unknown): string {
  return error instanceof PaymentProviderError ? error.message : "o provedor de pagamento não respondeu.";
}

/** Pede o reembolso de um pedido pago. Devolve se o estorno precisa ser feito à mão (boleto). */
export async function requestOrderRefund(params: {
  orderId: string;
  actor: Actor;
  now?: Date;
}): Promise<{ manualRefund: boolean }> {
  const now = params.now ?? new Date();
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { payments: { select: { id: true, status: true, providerPaymentId: true } } },
  });
  // Pedido de outra pessoa = "não encontrado" (não revela que existe).
  if (!order || (!params.actor.isAdmin && order.userId !== params.actor.userId)) {
    throw new UserFacingError("Pedido não encontrado.");
  }
  const check = checkRefundEligibility({
    status: order.status,
    paidAt: order.paidAt,
    now,
    requestedBy: params.actor.isAdmin ? "ADMIN" : "STUDENT",
  });
  if (!check.ok) throw new UserFacingError(check.reason);

  const provider = getProviderForRecord(order.provider);
  if (!provider) throw new UserFacingError("O provedor deste pedido não está disponível agora. Tente mais tarde.");
  if (!order.providerPaymentId) throw new UserFacingError("Este pedido não tem cobrança no provedor.");

  // 1. Pede o estorno ao provedor (boleto: à mão, no painel do Asaas).
  const manualRefund = order.method === "BOLETO";
  if (!manualRefund) {
    try {
      await provider.refundCharge({ paymentId: order.providerPaymentId, installmentId: order.providerInstallmentId });
    } catch (error) {
      throw new UserFacingError(`O provedor recusou o estorno: ${providerMessage(error)}`);
    }
  }

  // 2. Marca as cobranças pagas como "estorno em andamento" e recalcula o acesso (sai na hora).
  const paidPayments = order.payments.filter((payment) => isPaidStatus(payment.status));
  await prisma.$transaction(
    async (tx) => {
      for (const payment of paidPayments) {
        await advisoryLock(tx, `payment:${order.provider}:${payment.providerPaymentId}`);
        // Só se ainda estiver paga (um aviso REFUNDED pode ter chegado antes — ele vale).
        await tx.payment.updateMany({
          where: { id: payment.id, status: { in: ["CONFIRMED", "RECEIVED"] } },
          data: { status: "REFUND_REQUESTED", lastEventAt: dateToEventTime(now) },
        });
      }
      const payments = await tx.payment.findMany({ where: { orderId: order.id }, select: { status: true } });
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: deriveOrderStatus(payments),
          refundRequestedAt: now,
          refundRequestedBy: params.actor.isAdmin ? "ADMIN" : "STUDENT",
        },
      });
      await syncPaidAccess(tx, order.userId, now);
    },
    { timeout: 15_000 },
  );

  // 3. Depois de gravar: cancela as notas fiscais e avisa o aluno por e-mail.
  const effects: PaymentEffect[] = [
    ...paidPayments.map((payment) => ({ type: "CANCEL_INVOICE" as const, paymentId: payment.id })),
    { type: "REFUND_REQUESTED", userId: order.userId, itemTitle: order.productTitle, manualRefund },
  ];
  await runEffects(effects);
  return { manualRefund };
}

/**
 * Cancela uma assinatura. Com `refund: true`, também reembolsa:
 *  - aluno: só o 1º pagamento, em até 7 dias;
 *  - admin: o último pagamento.
 */
export async function cancelSubscription(params: {
  subscriptionId: string;
  actor: Actor;
  refund?: boolean;
  now?: Date;
}): Promise<{ refunded: boolean; manualRefund: boolean }> {
  const now = params.now ?? new Date();
  const subscription = await prisma.subscription.findUnique({
    where: { id: params.subscriptionId },
    include: {
      payments: {
        orderBy: { dueDate: "asc" },
        select: { id: true, status: true, paidAt: true, method: true, providerPaymentId: true },
      },
    },
  });
  if (!subscription || (!params.actor.isAdmin && subscription.userId !== params.actor.userId)) {
    throw new UserFacingError("Assinatura não encontrada.");
  }
  if (subscription.status === "CANCELED") throw new UserFacingError("Esta assinatura já está cancelada.");

  // Qual pagamento reembolsar (se pedido).
  const paid = subscription.payments.filter((payment) => isPaidStatus(payment.status));
  let refundPayment: (typeof paid)[number] | null = null;
  if (params.refund) {
    if (params.actor.isAdmin) {
      refundPayment = paid.at(-1) ?? null;
    } else if (paid.length === 1 && isWithinRefundWindow(paid[0].paidAt, now)) {
      refundPayment = paid[0];
    }
    if (!refundPayment) {
      throw new UserFacingError(
        "O reembolso pelo site vale só para o 1º pagamento da assinatura, em até 7 dias. Você ainda pode cancelar (sem reembolso).",
      );
    }
  }

  const provider = getProviderForRecord(subscription.provider);
  if (!provider) throw new UserFacingError("O provedor desta assinatura não está disponível agora. Tente mais tarde.");
  const manualRefund = refundPayment?.method === "BOLETO";
  try {
    if (subscription.providerSubscriptionId) await provider.cancelSubscription(subscription.providerSubscriptionId);
    if (refundPayment && !manualRefund) {
      await provider.refundCharge({ paymentId: refundPayment.providerPaymentId, installmentId: null });
    }
  } catch (error) {
    throw new UserFacingError(`O provedor recusou o pedido: ${providerMessage(error)}`);
  }

  const stamp = dateToEventTime(now);
  await prisma.$transaction(
    async (tx) => {
      await tx.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELED", canceledAt: now } });
      // Cobranças ainda em aberto deixam de valer (o provedor também as remove).
      await tx.payment.updateMany({
        where: { subscriptionId: subscription.id, status: { in: ["PENDING", "OVERDUE"] } },
        data: { status: "CANCELED", lastEventAt: stamp },
      });
      if (refundPayment) {
        await advisoryLock(tx, `payment:${subscription.provider}:${refundPayment.providerPaymentId}`);
        await tx.payment.updateMany({
          where: { id: refundPayment.id, status: { in: ["CONFIRMED", "RECEIVED"] } },
          data: { status: "REFUND_REQUESTED", lastEventAt: stamp },
        });
      }
      await syncPaidAccess(tx, subscription.userId, now);
    },
    { timeout: 15_000 },
  );

  if (refundPayment) {
    await runEffects([
      { type: "CANCEL_INVOICE", paymentId: refundPayment.id },
      {
        type: "REFUND_REQUESTED",
        userId: subscription.userId,
        itemTitle: `a assinatura ${subscription.planTitle}`,
        manualRefund: Boolean(manualRefund),
      },
    ]);
  }
  return { refunded: Boolean(refundPayment), manualRefund: Boolean(manualRefund) };
}
