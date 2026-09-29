/**
 * mapping.test.ts — Testes da tradução dos dados do Asaas (status, cobranças e avisos).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  dateToEventTime,
  eventTimeToDate,
  mapAsaasInvoiceStatus,
  mapAsaasPaymentStatus,
  parseAsaasWebhook,
} from "./mapping";

describe("mapAsaasPaymentStatus", () => {
  it("traduz os status que liberam, tiram ou esperam o acesso", () => {
    expect(mapAsaasPaymentStatus({ status: "PENDING" })).toBe("PENDING");
    expect(mapAsaasPaymentStatus({ status: "AWAITING_RISK_ANALYSIS" })).toBe("PENDING");
    expect(mapAsaasPaymentStatus({ status: "CONFIRMED" })).toBe("CONFIRMED");
    expect(mapAsaasPaymentStatus({ status: "RECEIVED" })).toBe("RECEIVED");
    expect(mapAsaasPaymentStatus({ status: "RECEIVED_IN_CASH" })).toBe("RECEIVED");
    expect(mapAsaasPaymentStatus({ status: "OVERDUE" })).toBe("OVERDUE");
    expect(mapAsaasPaymentStatus({ status: "REFUND_IN_PROGRESS" })).toBe("REFUND_REQUESTED");
    expect(mapAsaasPaymentStatus({ status: "REFUNDED" })).toBe("REFUNDED");
    expect(mapAsaasPaymentStatus({ status: "CHARGEBACK_DISPUTE" })).toBe("CHARGEBACK");
    expect(mapAsaasPaymentStatus({ status: "AWAITING_CHARGEBACK_REVERSAL" })).toBe("CHARGEBACK");
  });

  it("cobrança removida vira cancelada; status desconhecido não libera nada", () => {
    expect(mapAsaasPaymentStatus({ status: "PENDING", deleted: true })).toBe("CANCELED");
    expect(mapAsaasPaymentStatus({ status: "PENDING", event: "PAYMENT_DELETED" })).toBe("CANCELED");
    expect(mapAsaasPaymentStatus({ status: "ALGO_NOVO" })).toBe("PENDING");
    expect(mapAsaasPaymentStatus({ status: null })).toBe("PENDING");
  });

  it("notas fiscais", () => {
    expect(mapAsaasInvoiceStatus("AUTHORIZED")).toBe("AUTHORIZED");
    expect(mapAsaasInvoiceStatus("ERROR")).toBe("ERROR");
    expect(mapAsaasInvoiceStatus("CANCELED")).toBe("CANCELED");
  });
});

describe("parseAsaasWebhook", () => {
  const paymentEvent = {
    id: "evt_05b708f961d739ea7eba7e4db318f621&368604920",
    event: "PAYMENT_RECEIVED",
    dateCreated: "2026-09-29 10:00:00",
    payment: {
      object: "payment",
      id: "pay_080225913252",
      customer: "cus_000005219613",
      installment: null,
      value: 97.9,
      netValue: 95.5,
      billingType: "PIX",
      status: "RECEIVED",
      dueDate: "2026-09-30",
      externalReference: "pedido-123",
      invoiceUrl: "https://sandbox.asaas.com/i/080225913252",
      deleted: false,
    },
  };

  it("aviso de cobrança: traduz para centavos, nosso status e nossa forma de pagamento", () => {
    const result = parseAsaasWebhook(paymentEvent);
    expect(result).toEqual({
      ok: true,
      webhook: {
        kind: "payment",
        eventId: paymentEvent.id,
        type: "PAYMENT_RECEIVED",
        occurredAt: "2026-09-29 10:00:00",
        charge: {
          paymentId: "pay_080225913252",
          installmentId: null,
          subscriptionId: null,
          externalReference: "pedido-123",
          method: "PIX",
          status: "RECEIVED",
          providerStatus: "RECEIVED",
          valueCents: 9790,
          dueDate: "2026-09-30",
          installmentNumber: null,
          invoiceUrl: "https://sandbox.asaas.com/i/080225913252",
          bankSlipUrl: null,
        },
      },
    });
  });

  it("aviso de cobrança da assinatura traz o ID da assinatura", () => {
    const result = parseAsaasWebhook({
      ...paymentEvent,
      event: "PAYMENT_CREATED",
      payment: { ...paymentEvent.payment, status: "PENDING", subscription: "sub_123" },
    });
    expect(result.ok && result.webhook.kind === "payment" && result.webhook.charge.subscriptionId).toBe("sub_123");
  });

  it("recusa aviso sem ID, sem tipo, ou de cobrança sem os dados", () => {
    expect(parseAsaasWebhook({ event: "PAYMENT_RECEIVED" })).toMatchObject({ ok: false });
    expect(parseAsaasWebhook({ id: "evt_1" })).toMatchObject({ ok: false });
    expect(parseAsaasWebhook({ id: "evt_1", event: "PAYMENT_RECEIVED" })).toMatchObject({ ok: false });
    expect(parseAsaasWebhook("não é json")).toMatchObject({ ok: false });
  });

  it("nota fiscal e assinatura", () => {
    const invoice = parseAsaasWebhook({
      id: "evt_2",
      event: "INVOICE_AUTHORIZED",
      invoice: { id: "inv_1", payment: "pay_1", status: "AUTHORIZED", number: "123", pdfUrl: "https://x/nf.pdf" },
    });
    expect(invoice).toMatchObject({
      ok: true,
      webhook: { kind: "invoice", invoice: { invoiceId: "inv_1", status: "AUTHORIZED", number: "123" } },
    });

    const deleted = parseAsaasWebhook({ id: "evt_3", event: "SUBSCRIPTION_DELETED", subscription: { id: "sub_1" } });
    expect(deleted).toMatchObject({ ok: true, webhook: { kind: "subscription", subscription: { id: "sub_1", ended: true } } });
    const updated = parseAsaasWebhook({
      id: "evt_4",
      event: "SUBSCRIPTION_UPDATED",
      subscription: { id: "sub_1", status: "ACTIVE" },
    });
    expect(updated).toMatchObject({ ok: true, webhook: { subscription: { ended: false } } });
  });

  it("tipos que o site não usa são aceitos como 'other'", () => {
    expect(parseAsaasWebhook({ id: "evt_5", event: "TRANSFER_DONE" })).toMatchObject({ ok: true, webhook: { kind: "other" } });
  });

  it("data inválida do aviso é ignorada (sem quebrar)", () => {
    const result = parseAsaasWebhook({ ...paymentEvent, dateCreated: "ontem" });
    expect(result.ok && result.webhook.occurredAt).toBeNull();
  });
});

describe("data/hora dos avisos (horário de Brasília)", () => {
  it("ida e volta", () => {
    const date = eventTimeToDate("2026-09-29 10:00:00");
    expect(date.toISOString()).toBe("2026-09-29T13:00:00.000Z");
    expect(dateToEventTime(date)).toBe("2026-09-29 10:00:00");
  });

  it("comparar os textos equivale a comparar as datas", () => {
    expect(dateToEventTime(new Date("2026-09-29T13:00:01Z")) > "2026-09-29 10:00:00").toBe(true);
  });
});
