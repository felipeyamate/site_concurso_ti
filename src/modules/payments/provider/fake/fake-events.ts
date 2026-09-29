/**
 * fake-events.ts — Monta avisos (webhooks) no FORMATO DO ASAAS para o modo simulado.
 *
 * Quem chama: a página /dev/pagamentos (botões "Pagar", "Estornar", "Contestar", "Próximo ciclo")
 * e os testes. O aviso montado aqui passa pelo mesmo processamento dos avisos reais.
 *
 * Arquivo "puro" (recebe o ID do evento e a hora de fora), testado em `fake-events.test.ts`.
 */
import type { PaymentMethod } from "@/generated/prisma/enums";

import type { DateOnly } from "../../dates";
import { centsToReais } from "../../money";
import { dateToEventTime } from "../asaas/mapping";

export type FakeAction = "PAY" | "OVERDUE" | "REFUND" | "REFUND_DENIED" | "CHARGEBACK" | "DELETE";

// Para cada botão: o tipo do aviso e o status da cobrança que o Asaas mandaria.
function eventFor(action: FakeAction, method: PaymentMethod): { event: string; status: string } {
  // Cartão aprovado = CONFIRMED (o dinheiro cai depois); Pix/boleto pagos = RECEIVED.
  const paidStatus = method === "CREDIT_CARD" ? "CONFIRMED" : "RECEIVED";
  switch (action) {
    case "PAY":
      return { event: method === "CREDIT_CARD" ? "PAYMENT_CONFIRMED" : "PAYMENT_RECEIVED", status: paidStatus };
    case "OVERDUE":
      return { event: "PAYMENT_OVERDUE", status: "OVERDUE" };
    case "REFUND":
      return { event: "PAYMENT_REFUNDED", status: "REFUNDED" };
    case "REFUND_DENIED":
      return { event: "PAYMENT_REFUND_DENIED", status: paidStatus };
    case "CHARGEBACK":
      return { event: "PAYMENT_CHARGEBACK_REQUESTED", status: "CHARGEBACK_REQUESTED" };
    case "DELETE":
      return { event: "PAYMENT_DELETED", status: "PENDING" };
  }
}

export type FakeChargeData = {
  providerPaymentId: string;
  method: PaymentMethod;
  valueCents: number;
  dueDate: DateOnly;
  externalReference: string | null;
  installmentId: string | null;
  installmentNumber: number | null;
  subscriptionId: string | null;
  invoiceUrl: string | null;
};

/** Um aviso de cobrança no formato do Asaas. */
export function buildFakePaymentEvent(input: {
  eventId: string;
  action: FakeAction;
  charge: FakeChargeData;
  now: Date;
}) {
  const { event, status } = eventFor(input.action, input.charge.method);
  return {
    id: input.eventId,
    event,
    dateCreated: dateToEventTime(input.now),
    payment: {
      object: "payment",
      id: input.charge.providerPaymentId,
      customer: "cus_fake",
      subscription: input.charge.subscriptionId,
      installment: input.charge.installmentId,
      installmentNumber: input.charge.installmentNumber,
      value: centsToReais(input.charge.valueCents),
      billingType: input.charge.method,
      status,
      dueDate: input.charge.dueDate,
      externalReference: input.charge.externalReference,
      invoiceUrl: input.charge.invoiceUrl,
      deleted: input.action === "DELETE",
    },
  };
}

/** O aviso de uma NOVA cobrança da assinatura (o Asaas gera uma por ciclo). */
export function buildFakeNextCycleEvent(input: {
  eventId: string;
  newPaymentId: string;
  subscriptionId: string;
  externalReference: string | null;
  method: PaymentMethod;
  valueCents: number;
  dueDate: DateOnly;
  invoiceUrl: string;
  now: Date;
}) {
  return {
    id: input.eventId,
    event: "PAYMENT_CREATED",
    dateCreated: dateToEventTime(input.now),
    payment: {
      object: "payment",
      id: input.newPaymentId,
      customer: "cus_fake",
      subscription: input.subscriptionId,
      value: centsToReais(input.valueCents),
      billingType: input.method,
      status: "PENDING",
      dueDate: input.dueDate,
      externalReference: input.externalReference,
      invoiceUrl: input.invoiceUrl,
      deleted: false,
    },
  };
}
