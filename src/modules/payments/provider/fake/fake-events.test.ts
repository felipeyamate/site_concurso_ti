/**
 * fake-events.test.ts — Os avisos simulados seguem o formato do Asaas (e são lidos pelo mesmo
 * código que lê os avisos reais).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { parseAsaasWebhook } from "../asaas/mapping";
import { buildFakeNextCycleEvent, buildFakePaymentEvent, type FakeChargeData } from "./fake-events";

const NOW = new Date("2026-09-29T13:00:00Z");
const charge: FakeChargeData = {
  providerPaymentId: "pay_fake_1",
  method: "PIX",
  valueCents: 9790,
  dueDate: "2026-09-30",
  externalReference: "pedido-1",
  installmentId: null,
  installmentNumber: null,
  subscriptionId: null,
  invoiceUrl: "/dev/pagamentos/pay_fake_1",
};

describe("buildFakePaymentEvent", () => {
  it("Pix pago = PAYMENT_RECEIVED/RECEIVED; cartão aprovado = PAYMENT_CONFIRMED/CONFIRMED", () => {
    const pix = parseAsaasWebhook(buildFakePaymentEvent({ eventId: "evt_1", action: "PAY", charge, now: NOW }));
    expect(pix).toMatchObject({
      ok: true,
      webhook: {
        kind: "payment",
        type: "PAYMENT_RECEIVED",
        occurredAt: "2026-09-29 10:00:00",
        charge: { paymentId: "pay_fake_1", status: "RECEIVED", valueCents: 9790, externalReference: "pedido-1" },
      },
    });
    const card = parseAsaasWebhook(
      buildFakePaymentEvent({ eventId: "evt_2", action: "PAY", charge: { ...charge, method: "CREDIT_CARD" }, now: NOW }),
    );
    expect(card).toMatchObject({ ok: true, webhook: { type: "PAYMENT_CONFIRMED", charge: { status: "CONFIRMED" } } });
  });

  it("estorno, contestação, estorno negado e remoção", () => {
    const status = (action: Parameters<typeof buildFakePaymentEvent>[0]["action"]) => {
      const parsed = parseAsaasWebhook(buildFakePaymentEvent({ eventId: "evt", action, charge, now: NOW }));
      return parsed.ok && parsed.webhook.kind === "payment" ? parsed.webhook.charge.status : null;
    };
    expect(status("REFUND")).toBe("REFUNDED");
    expect(status("CHARGEBACK")).toBe("CHARGEBACK");
    expect(status("REFUND_DENIED")).toBe("RECEIVED");
    expect(status("OVERDUE")).toBe("OVERDUE");
    expect(status("DELETE")).toBe("CANCELED");
  });

  it("nova cobrança da assinatura (próximo ciclo)", () => {
    const parsed = parseAsaasWebhook(
      buildFakeNextCycleEvent({
        eventId: "evt_9",
        newPaymentId: "pay_fake_2",
        subscriptionId: "sub_fake_1",
        externalReference: "assinatura-1",
        method: "CREDIT_CARD",
        valueCents: 4990,
        dueDate: "2026-10-29",
        invoiceUrl: "/dev/pagamentos/pay_fake_2",
        now: NOW,
      }),
    );
    expect(parsed).toMatchObject({
      ok: true,
      webhook: {
        type: "PAYMENT_CREATED",
        charge: { paymentId: "pay_fake_2", subscriptionId: "sub_fake_1", status: "PENDING", dueDate: "2026-10-29" },
      },
    });
  });
});
