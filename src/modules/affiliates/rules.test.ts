/**
 * rules.test.ts — Afiliados: código, comissão, situação da comissão e quem fica com a venda.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  commissionCents,
  commissionReleaseDate,
  commissionStatus,
  formatCommissionRate,
  isValidAffiliateCode,
  normalizeAffiliateCode,
  referralLink,
  resolveAttribution,
  summarizeCommissions,
} from "./rules";

const NOW = new Date("2026-10-10T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

describe("código e comissão", () => {
  it("código: minúsculas, números e hífen (3 a 30)", () => {
    expect(normalizeAffiliateCode(" Joao-10 ")).toBe("joao-10");
    expect(isValidAffiliateCode("joao-10")).toBe(true);
    expect(isValidAffiliateCode("jo")).toBe(false);
    expect(isValidAffiliateCode("joão")).toBe(false);
  });

  it("comissão em pontos-base, arredondando para baixo", () => {
    expect(commissionCents(19700, 2000)).toBe(3940);
    expect(commissionCents(4990, 1250)).toBe(623); // 623,75 → 623
    expect(formatCommissionRate(2000)).toBe("20%");
    expect(formatCommissionRate(1250)).toBe("12,5%");
  });
});

describe("commissionStatus", () => {
  const status = (paymentStatus: Parameters<typeof commissionStatus>[0]["paymentStatus"], paidAt: Date | null, paidOut = false) =>
    commissionStatus({ paymentStatus, paidAt, paidOut, now: NOW });

  it("cobrança não paga não gera comissão", () => {
    expect(status("PENDING", null)).toBeNull();
    expect(status("OVERDUE", null)).toBeNull();
    expect(status("CANCELED", null)).toBeNull();
  });

  it("paga: 7 dias de carência e depois liberada", () => {
    expect(status("CONFIRMED", daysAgo(2))).toEqual({ status: "HOLD", refundedAfterPayout: false });
    expect(status("RECEIVED", daysAgo(7))).toEqual({ status: "AVAILABLE", refundedAfterPayout: false });
    expect(commissionReleaseDate(daysAgo(2)).toISOString()).toBe(new Date(NOW.getTime() + 5 * 86400000).toISOString());
  });

  it("estorno ou contestação cancelam; depois de paga ao afiliado, avisa", () => {
    expect(status("REFUNDED", daysAgo(3))).toEqual({ status: "CANCELED", refundedAfterPayout: false });
    expect(status("CHARGEBACK", daysAgo(30))).toEqual({ status: "CANCELED", refundedAfterPayout: false });
    expect(status("RECEIVED", daysAgo(30), true)).toEqual({ status: "PAID_OUT", refundedAfterPayout: false });
    expect(status("REFUNDED", daysAgo(30), true)).toEqual({ status: "PAID_OUT", refundedAfterPayout: true });
  });

  it("soma por situação", () => {
    expect(
      summarizeCommissions([
        { status: "HOLD", amountCents: 100 },
        { status: "AVAILABLE", amountCents: 200 },
        { status: "AVAILABLE", amountCents: 50 },
        { status: "CANCELED", amountCents: 70 },
      ]),
    ).toEqual({ HOLD: 100, AVAILABLE: 250, PAID_OUT: 0, CANCELED: 70 });
  });
});

describe("resolveAttribution", () => {
  const joao = { id: "a1", userId: "u-joao", commissionBps: 2000, isActive: true };
  const maria = { id: "a2", userId: "u-maria", commissionBps: 1500, isActive: true };

  it("o cupom do afiliado ganha do link; afiliado inativo não conta", () => {
    expect(resolveAttribution({ couponAffiliate: maria, linkAffiliate: joao, buyerId: "u-aluno" })).toEqual({ affiliateId: "a2", commissionBps: 1500 });
    expect(resolveAttribution({ couponAffiliate: null, linkAffiliate: joao, buyerId: "u-aluno" })).toEqual({ affiliateId: "a1", commissionBps: 2000 });
    expect(resolveAttribution({ couponAffiliate: { ...maria, isActive: false }, linkAffiliate: joao, buyerId: "u-aluno" })).toEqual({
      affiliateId: "a1",
      commissionBps: 2000,
    });
    expect(resolveAttribution({ couponAffiliate: null, linkAffiliate: null, buyerId: "u-aluno" })).toBeNull();
  });

  it("comprar pelo próprio link/cupom não gera comissão", () => {
    expect(resolveAttribution({ couponAffiliate: null, linkAffiliate: joao, buyerId: "u-joao" })).toBeNull();
  });
});

describe("referralLink", () => {
  it("com e sem página de destino", () => {
    expect(referralLink("https://concursoti.com.br", "joao", null)).toBe("https://concursoti.com.br/r/joao");
    expect(referralLink("https://concursoti.com.br", "joao", "/cursos/base")).toBe("https://concursoti.com.br/r/joao?para=%2Fcursos%2Fbase");
  });
});
