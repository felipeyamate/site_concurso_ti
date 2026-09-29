/**
 * simulator.server.ts — Simula o que o Asaas faria com uma cobrança SIMULADA (modo sem conta).
 *
 * Quem chama: a página /dev/pagamentos (botões) e os testes de integração.
 *
 * Cada botão monta um aviso no formato do Asaas (`fake/fake-events.ts`) e o entrega para o MESMO
 * processamento dos avisos reais (`receiveWebhook`). Só funciona fora de produção e só para
 * cobranças do provedor simulado (FAKE) — nunca mexe numa cobrança real.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";

import { utcToDateOnly } from "./dates";
import { buildFakeNextCycleEvent, buildFakePaymentEvent, type FakeAction } from "./provider/fake/fake-events";
import { fakePaymentPageUrl } from "./provider/fake/fake-provider";
import { nextCycleDueDate } from "./rules";
import { receiveWebhook, type WebhookOutcome } from "./webhook.server";

function assertSimulationAllowed(): void {
  if (env.NODE_ENV === "production") throw new UserFacingError("Simulação de pagamentos desligada em produção.");
}

function fakeEventId(): string {
  return `evt_fake_${randomUUID()}`;
}

async function deliver(body: unknown, now: Date): Promise<WebhookOutcome> {
  const result = await receiveWebhook({ provider: "FAKE", body, now });
  if (!result.ok) throw new Error(result.error);
  return result.outcome;
}

/** Simula um acontecimento numa cobrança simulada: pagar, vencer, estornar, contestar... */
export async function simulatePaymentAction(params: {
  paymentId: string;
  action: FakeAction;
  now?: Date;
}): Promise<WebhookOutcome> {
  assertSimulationAllowed();
  const now = params.now ?? new Date();
  const payment = await prisma.payment.findUnique({
    where: { id: params.paymentId },
    include: {
      order: { select: { id: true, providerInstallmentId: true } },
      subscription: { select: { id: true, providerSubscriptionId: true } },
    },
  });
  if (!payment || payment.provider !== "FAKE") throw new UserFacingError("Cobrança simulada não encontrada.");

  const body = buildFakePaymentEvent({
    eventId: fakeEventId(),
    action: params.action,
    charge: {
      providerPaymentId: payment.providerPaymentId,
      method: payment.method,
      valueCents: payment.valueCents,
      dueDate: utcToDateOnly(payment.dueDate),
      externalReference: payment.order?.id ?? payment.subscription?.id ?? null,
      installmentId: payment.order?.providerInstallmentId ?? null,
      installmentNumber: payment.installmentNumber,
      subscriptionId: payment.subscription?.providerSubscriptionId ?? null,
      invoiceUrl: payment.invoiceUrl,
    },
    now,
  });
  return deliver(body, now);
}

/** Simula a cobrança do PRÓXIMO ciclo de uma assinatura simulada (o Asaas gera uma por ciclo). */
export async function simulateNextCycle(params: { subscriptionId: string; now?: Date }): Promise<WebhookOutcome> {
  assertSimulationAllowed();
  const now = params.now ?? new Date();
  const subscription = await prisma.subscription.findUnique({
    where: { id: params.subscriptionId },
    include: { payments: { orderBy: { dueDate: "desc" }, take: 1, select: { dueDate: true } } },
  });
  if (!subscription || subscription.provider !== "FAKE" || !subscription.providerSubscriptionId) {
    throw new UserFacingError("Assinatura simulada não encontrada.");
  }
  if (subscription.status === "CANCELED") throw new UserFacingError("Assinatura cancelada não gera novas cobranças.");
  const last = subscription.payments[0];
  if (!last) throw new UserFacingError("A assinatura ainda não tem a 1ª cobrança.");

  const newPaymentId = `pay_fake_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const body = buildFakeNextCycleEvent({
    eventId: fakeEventId(),
    newPaymentId,
    subscriptionId: subscription.providerSubscriptionId,
    externalReference: subscription.id,
    method: subscription.method,
    valueCents: subscription.priceCents,
    dueDate: nextCycleDueDate(utcToDateOnly(last.dueDate), subscription.cycle),
    invoiceUrl: fakePaymentPageUrl(newPaymentId),
    now,
  });
  return deliver(body, now);
}
