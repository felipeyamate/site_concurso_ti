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
 *
 * Cada operação roda com uma TRAVA do pedido/assinatura (e as chamadas ao provedor ficam dentro
 * dela, de propósito): dois pedidos ao mesmo tempo (duplo clique, aluno + admin) esperam um pelo
 * outro, e o segundo já vê o resultado do primeiro — nunca dois estornos da mesma cobrança.
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
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

type Tx = Prisma.TransactionClient;

function providerMessage(error: unknown): string {
  return error instanceof PaymentProviderError ? error.message : "o provedor de pagamento não respondeu.";
}

/**
 * Roda `work` numa transação com a trava `key` (ver `advisoryLock`). O tempo limite é maior que o
 * normal porque o trabalho inclui chamadas ao provedor (até 15 s cada) e pode esperar a trava.
 * Paralelo em Python: `with lock:` em volta do bloco — só que a trava vale entre servidores.
 */
async function withLock<T>(key: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await advisoryLock(tx, key);
      return work(tx);
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

/**
 * Pede o reembolso de um pedido pago. Devolve se o estorno precisa ser feito à mão (boleto).
 *
 * Passos (com a trava do pedido):
 *  1. Relê o pedido e confere quem pede e se pode (pago; aluno: até 7 dias).
 *  2. Pede o estorno ao provedor (boleto: não — é feito à mão no painel do Asaas).
 *  3. Marca as cobranças pagas como "estorno em andamento" e recalcula o acesso (sai na hora).
 *     No boleto, marca também `manualRefundRequestedAt`: até o estorno aparecer no provedor, um
 *     "paga" vindo de lá não devolve o acesso (ver `charges.server.ts`).
 *  4. Depois da transação: cancela as notas fiscais e avisa o aluno por e-mail.
 */
export async function requestOrderRefund(params: {
  orderId: string;
  actor: Actor;
  now?: Date;
}): Promise<{ manualRefund: boolean }> {
  const now = params.now ?? new Date();
  const done = await withLock(`refund:order:${params.orderId}`, async (tx) => {
    const order = await tx.order.findUnique({
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

    // 2. Pede o estorno ao provedor (boleto: à mão, no painel do Asaas).
    const manualRefund = order.method === "BOLETO";
    if (!manualRefund) {
      try {
        await provider.refundCharge({ paymentId: order.providerPaymentId, installmentId: order.providerInstallmentId });
      } catch (error) {
        throw new UserFacingError(`O provedor recusou o estorno: ${providerMessage(error)}`);
      }
    }

    // 3. Marca as cobranças pagas e recalcula o acesso.
    const paidPayments = order.payments.filter((payment) => isPaidStatus(payment.status));
    for (const payment of paidPayments) {
      await markRefundRequested(tx, {
        provider: order.provider,
        payment,
        manualRefund,
        now,
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
    return { manualRefund, userId: order.userId, itemTitle: order.productTitle, paymentIds: paidPayments.map((p) => p.id) };
  });

  // 4. Depois de gravar: cancela as notas fiscais e avisa o aluno por e-mail.
  const effects: PaymentEffect[] = [
    ...done.paymentIds.map((paymentId) => ({ type: "CANCEL_INVOICE" as const, paymentId })),
    { type: "REFUND_REQUESTED", userId: done.userId, itemTitle: done.itemTitle, manualRefund: done.manualRefund },
  ];
  await runEffects(effects);
  return { manualRefund: done.manualRefund };
}

/**
 * Marca uma cobrança paga como "estorno em andamento" (só se ainda estiver paga: um aviso
 * REFUNDED pode ter chegado antes — ele vale). `manualRefund` = estorno à mão no provedor (boleto).
 */
async function markRefundRequested(
  tx: Tx,
  input: { provider: string; payment: { id: string; providerPaymentId: string }; manualRefund: boolean; now: Date },
): Promise<void> {
  await advisoryLock(tx, `payment:${input.provider}:${input.payment.providerPaymentId}`);
  await tx.payment.updateMany({
    where: { id: input.payment.id, status: { in: ["CONFIRMED", "RECEIVED"] } },
    data: {
      status: "REFUND_REQUESTED",
      lastEventAt: dateToEventTime(input.now),
      manualRefundRequestedAt: input.manualRefund ? input.now : null,
    },
  });
}

export type CancelSubscriptionResult = {
  refunded: boolean;
  manualRefund: boolean;
  // O estorno foi feito, mas o provedor recusou o cancelamento (a assinatura continua ativa aqui e
  // lá: tentar "Cancelar" de novo). `null` = cancelada.
  cancelFailure: string | null;
};

/**
 * Cancela uma assinatura. Com `refund: true`, também reembolsa:
 *  - aluno: só o 1º pagamento, em até 7 dias;
 *  - admin: o último pagamento.
 *
 * Passos (com a trava da assinatura):
 *  1. Relê a assinatura, confere quem pede e escolhe o pagamento a reembolsar.
 *  2. ESTORNO primeiro: se o provedor recusar, nada mudou — dá para tentar de novo (o direito aos
 *     7 dias não se perde por uma falha do provedor).
 *  3. Grava o estorno (o acesso daquele pagamento sai).
 *  4. Cancela no provedor. Se isso falhar DEPOIS do estorno, o estorno continua gravado (ele
 *     aconteceu) e a resposta avisa para tentar cancelar de novo.
 *  5. Grava o cancelamento e recalcula o acesso (cancelada = sem a tolerância de 5 dias).
 */
export async function cancelSubscription(params: {
  subscriptionId: string;
  actor: Actor;
  refund?: boolean;
  now?: Date;
}): Promise<CancelSubscriptionResult> {
  const now = params.now ?? new Date();
  const done = await withLock(`subscription:${params.subscriptionId}`, async (tx) => {
    const subscription = await tx.subscription.findUnique({
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

    // 1. Qual pagamento reembolsar (se pedido).
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

    // 2 e 3. Estorno primeiro (boleto: à mão, no painel do Asaas) e grava.
    const manualRefund = refundPayment?.method === "BOLETO";
    if (refundPayment) {
      if (!manualRefund) {
        try {
          await provider.refundCharge({ paymentId: refundPayment.providerPaymentId, installmentId: null });
        } catch (error) {
          throw new UserFacingError(`O provedor recusou o estorno: ${providerMessage(error)}`);
        }
      }
      await markRefundRequested(tx, { provider: subscription.provider, payment: refundPayment, manualRefund, now });
    }

    // 4. Cancela no provedor.
    let cancelFailure: string | null = null;
    try {
      if (subscription.providerSubscriptionId) await provider.cancelSubscription(subscription.providerSubscriptionId);
    } catch (error) {
      cancelFailure = providerMessage(error);
    }
    // Sem estorno, uma falha aqui não deixou nada para gravar: é só um erro.
    if (cancelFailure && !refundPayment) {
      throw new UserFacingError(`O provedor recusou o cancelamento: ${cancelFailure}`);
    }

    // 5. Grava o cancelamento. Cobranças ainda em aberto deixam de valer (o provedor também as remove).
    if (!cancelFailure) {
      await tx.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELED", canceledAt: now } });
      await tx.payment.updateMany({
        where: { subscriptionId: subscription.id, status: { in: ["PENDING", "OVERDUE"] } },
        data: { status: "CANCELED", lastEventAt: dateToEventTime(now) },
      });
    }
    await syncPaidAccess(tx, subscription.userId, now);
    return {
      userId: subscription.userId,
      planTitle: subscription.planTitle,
      refundPaymentId: refundPayment?.id ?? null,
      manualRefund: Boolean(manualRefund),
      cancelFailure,
    };
  });

  if (done.refundPaymentId) {
    await runEffects([
      { type: "CANCEL_INVOICE", paymentId: done.refundPaymentId },
      {
        type: "REFUND_REQUESTED",
        userId: done.userId,
        itemTitle: `a assinatura ${done.planTitle}`,
        manualRefund: done.manualRefund,
      },
    ]);
  }
  return { refunded: done.refundPaymentId !== null, manualRefund: done.manualRefund, cancelFailure: done.cancelFailure };
}
