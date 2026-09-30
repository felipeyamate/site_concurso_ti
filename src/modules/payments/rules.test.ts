/**
 * rules.test.ts — Testes das regras de venda (situação do pedido, reembolso, vencimento, ciclos).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  checkRefundEligibility,
  computeDueDate,
  deriveOrderStatus,
  isOutdatedChargeUpdate,
  isWithinRefundWindow,
  nextCycleDueDate,
  subscriptionPeriodEnd,
} from "./rules";

const NOW = new Date("2026-09-29T15:00:00Z"); // 12:00 em Brasília
const DAY = 24 * 60 * 60 * 1000;

describe("computeDueDate", () => {
  it("Pix e cartão vencem amanhã; boleto em 3 dias (dia de Brasília)", () => {
    expect(computeDueDate("PIX", NOW)).toBe("2026-09-30");
    expect(computeDueDate("CREDIT_CARD", NOW)).toBe("2026-09-30");
    expect(computeDueDate("BOLETO", NOW)).toBe("2026-10-02");
    // 23:30 em Brasília (02:30 UTC do dia seguinte): "hoje" ainda é 29/09.
    expect(computeDueDate("PIX", new Date("2026-09-30T02:30:00Z"))).toBe("2026-09-30");
  });
});

describe("deriveOrderStatus", () => {
  const order = (statuses: Array<Parameters<typeof deriveOrderStatus>[0][number]["status"]>) =>
    deriveOrderStatus(statuses.map((status) => ({ status })));

  it("aguardando, vencido, pago", () => {
    expect(order(["PENDING"])).toBe("PENDING");
    expect(order(["OVERDUE"])).toBe("OVERDUE");
    expect(order(["CONFIRMED"])).toBe("PAID");
    expect(order(["RECEIVED"])).toBe("PAID");
    expect(order([])).toBe("PENDING");
  });

  it("parcelado no cartão: basta uma parcela paga", () => {
    expect(order(["CONFIRMED", "CONFIRMED", "PENDING"])).toBe("PAID");
  });

  it("estorno e contestação ganham de pago (o acesso sai)", () => {
    expect(order(["REFUND_REQUESTED", "CONFIRMED"])).toBe("REFUND_REQUESTED");
    expect(order(["REFUND_REQUESTED"])).toBe("REFUND_REQUESTED");
    expect(order(["REFUNDED", "CONFIRMED"])).toBe("REFUNDED");
    expect(order(["CONFIRMED", "CHARGEBACK"])).toBe("CHARGEBACK");
    expect(order(["REFUNDED", "CHARGEBACK"])).toBe("CHARGEBACK");
  });

  it("cancelado só quando todas as cobranças foram canceladas", () => {
    expect(order(["CANCELED"])).toBe("CANCELED");
    expect(order(["CANCELED", "PENDING"])).toBe("PENDING");
  });
});

describe("reembolso", () => {
  const paidAt = new Date(NOW.getTime() - 3 * DAY);

  it("aluno pede em até 7 dias depois do pagamento", () => {
    expect(checkRefundEligibility({ status: "PAID", paidAt, now: NOW, requestedBy: "STUDENT" })).toEqual({ ok: true });
    expect(isWithinRefundWindow(new Date(NOW.getTime() - 7 * DAY), NOW)).toBe(true);
    expect(isWithinRefundWindow(new Date(NOW.getTime() - 7 * DAY - 1), NOW)).toBe(false);
  });

  it("depois de 7 dias, só o admin", () => {
    const old = new Date(NOW.getTime() - 10 * DAY);
    const student = checkRefundEligibility({ status: "PAID", paidAt: old, now: NOW, requestedBy: "STUDENT" });
    expect(student).toMatchObject({ ok: false, reason: expect.stringMatching(/7 dias/) });
    expect(checkRefundEligibility({ status: "PAID", paidAt: old, now: NOW, requestedBy: "ADMIN" })).toEqual({ ok: true });
  });

  it("não reembolsa pedido não pago nem reembolso já pedido", () => {
    expect(checkRefundEligibility({ status: "PENDING", paidAt: null, now: NOW, requestedBy: "ADMIN" })).toMatchObject({
      ok: false,
    });
    expect(
      checkRefundEligibility({ status: "REFUND_REQUESTED", paidAt, now: NOW, requestedBy: "ADMIN" }),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/já foi pedido/) });
  });
});

describe("ciclos da assinatura", () => {
  it("próxima cobrança: +1 mês (mensal) ou +12 meses (anual)", () => {
    expect(nextCycleDueDate("2026-10-01", "MONTHLY")).toBe("2026-11-01");
    expect(nextCycleDueDate("2026-01-31", "MONTHLY")).toBe("2026-02-28");
    expect(nextCycleDueDate("2026-10-01", "YEARLY")).toBe("2027-10-01");
  });

  it("assinatura valendo: um ciclo pago vale até o fim do 5º dia depois do próximo vencimento (Brasília)", () => {
    const active = { canceled: false };
    // 06/11 23:59:59.999 em Brasília = 07/11 02:59:59.999 UTC → a tela mostra "até 06/11" e vale o dia todo.
    expect(subscriptionPeriodEnd("2026-10-01", "MONTHLY", active).toISOString()).toBe("2026-11-07T02:59:59.999Z");
    expect(subscriptionPeriodEnd("2026-10-01", "YEARLY", active).toISOString()).toBe("2027-10-07T02:59:59.999Z");
  });

  it("assinatura cancelada: sem tolerância — vale até a véspera do próximo vencimento", () => {
    const canceled = { canceled: true };
    expect(subscriptionPeriodEnd("2026-10-01", "MONTHLY", canceled).toISOString()).toBe("2026-11-01T02:59:59.999Z");
    expect(subscriptionPeriodEnd("2026-01-31", "MONTHLY", canceled).toISOString()).toBe("2026-02-28T02:59:59.999Z");
  });
});

describe("isOutdatedChargeUpdate (aviso fora de ordem)", () => {
  const base = { lastAppliedAt: "2026-10-01 10:00:00", currentStatus: "RECEIVED" as const };

  it("mais antigo que o último aplicado: atrasado; mais novo: vale", () => {
    expect(isOutdatedChargeUpdate({ ...base, incomingAt: "2026-10-01 09:59:59", incomingStatus: "OVERDUE" })).toBe(true);
    expect(isOutdatedChargeUpdate({ ...base, incomingAt: "2026-10-01 10:00:01", incomingStatus: "OVERDUE" })).toBe(false);
  });

  it("no mesmo segundo, vale o status mais adiantado, em qualquer ordem de chegada", () => {
    const sameSecond = "2026-10-02 08:00:00";
    // Chegou "estornada" primeiro; "estorno em andamento" do mesmo segundo não desfaz.
    expect(
      isOutdatedChargeUpdate({
        incomingAt: sameSecond,
        incomingStatus: "REFUND_REQUESTED",
        lastAppliedAt: sameSecond,
        currentStatus: "REFUNDED",
      }),
    ).toBe(true);
    // Na ordem certa, "estornada" depois de "estorno em andamento" vale.
    expect(
      isOutdatedChargeUpdate({
        incomingAt: sameSecond,
        incomingStatus: "REFUNDED",
        lastAppliedAt: sameSecond,
        currentStatus: "REFUND_REQUESTED",
      }),
    ).toBe(false);
    // "Vencida" no mesmo segundo de "paga" não desfaz o pagamento.
    expect(
      isOutdatedChargeUpdate({ incomingAt: sameSecond, incomingStatus: "OVERDUE", lastAppliedAt: sameSecond, currentStatus: "CONFIRMED" }),
    ).toBe(true);
  });

  it("sem horário (conferência pelo painel, 1º registro) nunca é atrasado", () => {
    expect(isOutdatedChargeUpdate({ ...base, incomingAt: null, incomingStatus: "PENDING" })).toBe(false);
    expect(
      isOutdatedChargeUpdate({ incomingAt: "2026-10-01 10:00:00", incomingStatus: "PENDING", lastAppliedAt: null, currentStatus: "PENDING" }),
    ).toBe(false);
  });
});
