/**
 * charges.server.ts — Aplica a situação de uma cobrança do provedor ao nosso banco.
 *
 * Quem chama:
 *  - os avisos do provedor (`webhook.server.ts`) → modo "event";
 *  - o checkout, logo depois de criar a cobrança → modo "initial" (só registra se ainda não existe);
 *  - o painel, "Conferir no Asaas" → modo "sync" (a situação atual do provedor vale).
 *
 * Passos (numa transação, com a trava da cobrança):
 *  1. Acha a nossa cobrança; se não existe, acha o DONO (pedido ou assinatura) pelo ID da
 *     assinatura/parcelamento no provedor ou pela nossa referência — e cria a cobrança.
 *     Cobrança sem dono (criada à mão no painel do Asaas) é ignorada.
 *  2. Ignora um aviso MAIS ANTIGO que o último aplicado (avisos podem chegar fora de ordem).
 *  3. Grava o novo status (exceto "paga" com estorno manual pendente — ver `manualRefundRequestedAt`);
 *     recalcula a situação do pedido / ativa a assinatura.
 *  4. Recalcula o acesso do aluno (`syncPaidAccess`) — nunca "soma" nada direto.
 *  5. Devolve os efeitos (e-mail, nota fiscal, cancelar assinatura órfã no provedor) para rodar
 *     DEPOIS da transação.
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod, PaymentProviderKind, PaymentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { advisoryLock } from "@/lib/db-locks";

import { syncPaidAccess } from "./access-sync.server";
import { dateOnlyToUtc, startOfDayInSaoPaulo, toSaoPauloDate } from "./dates";
import type { PaymentEffect } from "./effects.server";
import { PAYMENT_STATUS_LABELS } from "./labels";
import { eventTimeToDate } from "./provider/asaas/mapping";
import type { ProviderCharge } from "./provider/types";
import { deriveOrderStatus, isOutdatedChargeUpdate, isPaidStatus, isReversedStatus } from "./rules";

type Tx = Prisma.TransactionClient;

export type ChargeUpdateMode = "event" | "initial" | "sync";

export type ChargeUpdateResult = {
  paymentId: string | null; // nossa cobrança (null = ignorada)
  note: string;
  effects: PaymentEffect[];
};

type ChargeOwner =
  | { kind: "order"; orderId: string; userId: string; method: PaymentMethod }
  // `orphan`: a assinatura existe no provedor, mas aqui a criação tinha falhado (ficou cancelada
  // sem o ID do provedor) — ela precisa ser cancelada lá, senão continua gerando cobranças.
  | { kind: "subscription"; subscriptionId: string; userId: string; method: PaymentMethod; orphan: boolean };

/** De quem é esta cobrança do provedor? (pedido ou assinatura do nosso site) */
async function findChargeOwner(tx: Tx, provider: PaymentProviderKind, charge: ProviderCharge): Promise<ChargeOwner | null> {
  if (charge.subscriptionId) {
    let subscription = await tx.subscription.findUnique({ where: { providerSubscriptionId: charge.subscriptionId } });
    let orphan = false;
    // A assinatura foi criada no provedor, mas o nosso registro do ID falhou (ex.: a resposta do
    // provedor se perdeu): acha pela referência. Se aqui ela ficou CANCELADA (o aluno viu "não foi
    // possível criar"), ela é uma órfã: guardamos o ID e pedimos o cancelamento no provedor.
    if (!subscription && charge.externalReference) {
      const byReference = await tx.subscription.findUnique({ where: { id: charge.externalReference } });
      if (byReference && byReference.provider === provider && !byReference.providerSubscriptionId) {
        orphan = byReference.status === "CANCELED";
        subscription = await tx.subscription.update({
          where: { id: byReference.id },
          data: { providerSubscriptionId: charge.subscriptionId },
        });
      }
    }
    if (!subscription || subscription.provider !== provider) return null;
    return {
      kind: "subscription",
      subscriptionId: subscription.id,
      userId: subscription.userId,
      method: subscription.method,
      orphan,
    };
  }

  if (charge.installmentId) {
    const order = await tx.order.findUnique({ where: { providerInstallmentId: charge.installmentId } });
    if (order && order.provider === provider) {
      return { kind: "order", orderId: order.id, userId: order.userId, method: order.method };
    }
  }

  if (charge.externalReference) {
    const order = await tx.order.findUnique({ where: { id: charge.externalReference } });
    // Só aceita se o pedido ainda não tem cobrança (ou se é do mesmo parcelamento): uma
    // cobrança "solta" com a nossa referência não pode sequestrar um pedido que já tem a sua.
    const sameCharge =
      order &&
      (!order.providerPaymentId ||
        order.providerPaymentId === charge.paymentId ||
        (charge.installmentId !== null && order.providerInstallmentId === charge.installmentId));
    if (order && order.provider === provider && sameCharge) {
      return { kind: "order", orderId: order.id, userId: order.userId, method: order.method };
    }
  }
  return null;
}

/**
 * Quando a cobrança foi paga pela 1ª vez:
 *  - num aviso: a hora do aviso (o provedor avisa na hora do pagamento);
 *  - sem aviso (ex.: "Conferir no Asaas" dias depois de um aviso perdido): o DIA do pagamento
 *    informado pelo provedor (início do dia, em Brasília) — nunca a hora do clique, que empurraria
 *    o prazo de 7 dias do reembolso e o início do acesso;
 *  - sem nenhuma das duas: agora.
 */
function firstPaidAt(input: { mode: ChargeUpdateMode; occurredAt: string | null }, charge: ProviderCharge, now: Date): Date {
  if (input.mode === "event" && input.occurredAt) return eventTimeToDate(input.occurredAt);
  if (charge.paidDate) {
    const startOfPaymentDay = startOfDayInSaoPaulo(charge.paidDate);
    return startOfPaymentDay < now ? startOfPaymentDay : now;
  }
  return input.occurredAt ? eventTimeToDate(input.occurredAt) : now;
}

async function applyInTransaction(
  tx: Tx,
  input: { provider: PaymentProviderKind; charge: ProviderCharge; occurredAt: string | null; mode: ChargeUpdateMode; now: Date },
): Promise<ChargeUpdateResult> {
  const { charge, provider, now } = input;
  await advisoryLock(tx, `payment:${provider}:${charge.paymentId}`);

  let payment = await tx.payment.findUnique({ where: { providerPaymentId: charge.paymentId } });
  let orphanSubscriptionId: string | null = null;
  let previousStatus: PaymentStatus = "PENDING";
  let previousPaidAt: Date | null = null;

  if (payment) {
    if (payment.provider !== provider) {
      return { paymentId: null, note: "Cobrança de outro provedor: ignorada.", effects: [] };
    }
    // Checkout: a cobrança já foi registrada (por um aviso que chegou antes) — não sobrescreve.
    if (input.mode === "initial") {
      return { paymentId: payment.id, note: "Cobrança já registrada.", effects: [] };
    }
    // Aviso mais antigo que o último aplicado: não desfaz o mais novo.
    const outdated = isOutdatedChargeUpdate({
      incomingAt: input.occurredAt,
      incomingStatus: charge.status,
      incomingIsRefundDenial: charge.refundDenied,
      lastAppliedAt: payment.lastEventAt,
      currentStatus: payment.status,
    });
    if (outdated) {
      return { paymentId: payment.id, note: "Aviso mais antigo que o último aplicado: ignorado.", effects: [] };
    }
    previousStatus = payment.status;
    previousPaidAt = payment.paidAt;
  } else {
    const owner = await findChargeOwner(tx, provider, charge);
    if (!owner) {
      return { paymentId: null, note: "Cobrança criada fora do site (sem pedido/assinatura): ignorada.", effects: [] };
    }
    if (owner.kind === "subscription" && owner.orphan && charge.subscriptionId) {
      orphanSubscriptionId = charge.subscriptionId;
    }
    payment = await tx.payment.create({
      data: {
        provider,
        providerPaymentId: charge.paymentId,
        orderId: owner.kind === "order" ? owner.orderId : null,
        subscriptionId: owner.kind === "subscription" ? owner.subscriptionId : null,
        method: charge.method ?? owner.method,
        status: "PENDING",
        providerStatus: charge.providerStatus,
        valueCents: charge.valueCents,
        dueDate: dateOnlyToUtc(charge.dueDate ?? toSaoPauloDate(now)),
        installmentNumber: charge.installmentNumber,
        invoiceUrl: charge.invoiceUrl,
        bankSlipUrl: charge.bankSlipUrl,
      },
    });
    // O pedido guarda a cobrança principal (a única, ou a 1ª parcela) e o parcelamento.
    if (owner.kind === "order" && (charge.installmentNumber ?? 1) === 1) {
      await tx.order.updateMany({
        where: { id: owner.orderId, providerPaymentId: null },
        data: { providerPaymentId: charge.paymentId, providerInstallmentId: charge.installmentId },
      });
    }
  }

  // Estorno manual pendente (boleto): o acesso já saiu, mas o provedor continua mostrando "paga"
  // até alguém fazer o estorno no painel dele. Esse "paga" NÃO devolve o acesso (senão um
  // "Conferir no Asaas" ou qualquer aviso da cobrança desfaria o reembolso). Quando o provedor
  // mostra outra situação (estorno em andamento, estornada...), o controle volta a ser dele.
  const keepManualRefund = payment.manualRefundRequestedAt !== null && isPaidStatus(charge.status);
  const status: PaymentStatus = keepManualRefund ? "REFUND_REQUESTED" : charge.status;

  // Grava a nova situação. `paidAt` = quando ficou paga pela 1ª vez (ver `firstPaidAt`).
  const nowPaid = isPaidStatus(status);
  const paidAt = nowPaid && !payment.paidAt ? firstPaidAt(input, charge, now) : payment.paidAt;
  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status,
      manualRefundRequestedAt: keepManualRefund ? payment.manualRefundRequestedAt : null,
      providerStatus: charge.providerStatus,
      valueCents: charge.valueCents > 0 ? charge.valueCents : payment.valueCents,
      ...(charge.dueDate ? { dueDate: dateOnlyToUtc(charge.dueDate) } : {}),
      paidAt,
      invoiceUrl: charge.invoiceUrl ?? payment.invoiceUrl,
      bankSlipUrl: charge.bankSlipUrl ?? payment.bankSlipUrl,
      lastEventAt: input.occurredAt ?? payment.lastEventAt,
    },
  });

  const effects: PaymentEffect[] = [];
  if (orphanSubscriptionId) {
    effects.push({ type: "CANCEL_PROVIDER_SUBSCRIPTION", provider, providerSubscriptionId: orphanSubscriptionId });
  }
  const wasPaid = isPaidStatus(previousStatus);
  if (nowPaid && !wasPaid) effects.push({ type: "SCHEDULE_INVOICE", paymentId: payment.id });
  if (isReversedStatus(status) && !isReversedStatus(previousStatus) && (wasPaid || previousPaidAt)) {
    effects.push({ type: "CANCEL_INVOICE", paymentId: payment.id });
  }

  let userId: string;
  if (payment.orderId) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: payment.orderId },
      select: { userId: true, paidAt: true, payments: { select: { status: true, paidAt: true } } },
    });
    const status = deriveOrderStatus(order.payments);
    const firstPaidAt = order.payments
      .map((item) => item.paidAt)
      .filter((date): date is Date => date !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    await tx.order.update({ where: { id: payment.orderId }, data: { status, paidAt: order.paidAt ?? firstPaidAt ?? null } });
    if (status === "PAID" && !order.paidAt) effects.push({ type: "ORDER_PAID", orderId: payment.orderId });
    userId = order.userId;
  } else {
    const subscription = await tx.subscription.findUniqueOrThrow({
      where: { id: payment.subscriptionId as string },
      select: { id: true, userId: true, status: true },
    });
    if (nowPaid && subscription.status === "PENDING") {
      await tx.subscription.update({ where: { id: subscription.id }, data: { status: "ACTIVE" } });
      effects.push({ type: "SUBSCRIPTION_STARTED", subscriptionId: subscription.id });
    }
    userId = subscription.userId;
  }

  await syncPaidAccess(tx, userId, now);

  const note = keepManualRefund
    ? `Cobrança ${charge.paymentId}: o provedor ainda mostra "paga", mas há estorno manual pendente — o acesso continua retirado.`
    : previousStatus === status
      ? `Cobrança ${charge.paymentId}: continua "${PAYMENT_STATUS_LABELS[status]}".`
      : `Cobrança ${charge.paymentId}: "${PAYMENT_STATUS_LABELS[previousStatus]}" → "${PAYMENT_STATUS_LABELS[status]}".`;
  return { paymentId: payment.id, note, effects };
}

/** Aplica a situação de uma cobrança (ver o cabeçalho). NÃO roda os efeitos — quem chama roda. */
export async function applyChargeUpdate(input: {
  provider: PaymentProviderKind;
  charge: ProviderCharge;
  occurredAt: string | null;
  mode: ChargeUpdateMode;
  now?: Date;
}): Promise<ChargeUpdateResult> {
  const now = input.now ?? new Date();
  return prisma.$transaction((tx) => applyInTransaction(tx, { ...input, now }), { timeout: 15_000 });
}
