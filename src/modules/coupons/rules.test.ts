/**
 * rules.test.ts — Cupons: normalização do código, desconto e quando o cupom vale.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  checkCoupon,
  computeDiscountCents,
  couponRejectionMessage,
  describeDiscount,
  normalizeCouponCode,
  type CouponRules,
} from "./rules";

const NOW = new Date("2026-10-01T12:00:00.000Z");
const base: CouponRules = {
  code: "BEMVINDO10",
  discountType: "PERCENT",
  discountValue: 10,
  appliesToProducts: true,
  appliesToPlans: false,
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  maxPerUser: 1,
  isActive: true,
  productIds: [],
  planIds: [],
};
const product = { kind: "PRODUCT" as const, id: "p1", priceCents: 19700 };
const noUses = { total: 0, byUser: 0 };

describe("normalizeCouponCode", () => {
  it("tira espaços e passa para maiúsculas", () => {
    expect(normalizeCouponCode("  bem vindo10 ")).toBe("BEMVINDO10");
  });
});

describe("computeDiscountCents", () => {
  it("percentual arredonda no centavo; valor fixo nunca passa do preço", () => {
    expect(computeDiscountCents("PERCENT", 10, 19700)).toBe(1970);
    expect(computeDiscountCents("PERCENT", 15, 4990)).toBe(749); // 7,485 → 7,49
    expect(computeDiscountCents("AMOUNT", 2000, 19700)).toBe(2000);
    expect(computeDiscountCents("AMOUNT", 50000, 19700)).toBe(19700);
  });
});

describe("checkCoupon", () => {
  it("cupom válido: desconto e preço final", () => {
    expect(checkCoupon({ coupon: base, target: product, now: NOW, redemptions: noUses })).toEqual({
      ok: true,
      discountCents: 1970,
      finalPriceCents: 17730,
    });
  });

  it("recusa na ordem: inexistente, desativado, antes do início, vencido", () => {
    const check = (coupon: CouponRules | null) => checkCoupon({ coupon, target: product, now: NOW, redemptions: noUses });
    expect(check(null)).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(check({ ...base, isActive: false })).toEqual({ ok: false, reason: "INACTIVE" });
    expect(check({ ...base, startsAt: new Date("2026-10-02T00:00:00Z") })).toEqual({ ok: false, reason: "NOT_STARTED" });
    // O fim é exclusivo: no instante do fim já não vale.
    expect(check({ ...base, endsAt: NOW })).toEqual({ ok: false, reason: "EXPIRED" });
    expect(check({ ...base, endsAt: new Date(NOW.getTime() + 1) })).toMatchObject({ ok: true });
  });

  it("onde vale: tipo de venda e a lista de produtos/planos", () => {
    const plan = { kind: "PLAN" as const, id: "m1", priceCents: 4990 };
    expect(checkCoupon({ coupon: base, target: plan, now: NOW, redemptions: noUses })).toEqual({ ok: false, reason: "NOT_APPLICABLE" });
    expect(checkCoupon({ coupon: { ...base, appliesToPlans: true }, target: plan, now: NOW, redemptions: noUses })).toMatchObject({
      ok: true,
      finalPriceCents: 4491,
    });
    const onlyP2 = { ...base, productIds: ["p2"] };
    expect(checkCoupon({ coupon: onlyP2, target: product, now: NOW, redemptions: noUses })).toEqual({ ok: false, reason: "NOT_APPLICABLE" });
    expect(checkCoupon({ coupon: onlyP2, target: { ...product, id: "p2" }, now: NOW, redemptions: noUses })).toMatchObject({ ok: true });
  });

  it("limites de uso: no total e por aluno", () => {
    const limited = { ...base, maxRedemptions: 50, maxPerUser: 2 };
    expect(checkCoupon({ coupon: limited, target: product, now: NOW, redemptions: { total: 50, byUser: 0 } })).toEqual({
      ok: false,
      reason: "SOLD_OUT",
    });
    expect(checkCoupon({ coupon: limited, target: product, now: NOW, redemptions: { total: 49, byUser: 1 } })).toMatchObject({ ok: true });
    expect(checkCoupon({ coupon: limited, target: product, now: NOW, redemptions: { total: 49, byUser: 2 } })).toEqual({
      ok: false,
      reason: "ALREADY_USED",
    });
  });

  it("pedido do aluno aguardando pagamento: mensagem própria (pagar ou esperar vencer)", () => {
    const once = { ...base, maxPerUser: 1 };
    // O único uso do aluno é uma reserva (Pix gerado e não pago).
    expect(checkCoupon({ coupon: once, target: product, now: NOW, redemptions: { total: 1, byUser: 1, pendingByUser: 1 } })).toEqual({
      ok: false,
      reason: "PENDING_BY_USER",
    });
    // Já pagou uma vez: "você já usou", mesmo tendo outra reserva.
    const twice = { ...base, maxPerUser: 2 };
    expect(checkCoupon({ coupon: twice, target: product, now: NOW, redemptions: { total: 2, byUser: 2, pendingByUser: 1 } })).toEqual({
      ok: false,
      reason: "PENDING_BY_USER",
    });
    expect(checkCoupon({ coupon: once, target: product, now: NOW, redemptions: { total: 2, byUser: 2, pendingByUser: 1 } })).toEqual({
      ok: false,
      reason: "ALREADY_USED",
    });
    expect(couponRejectionMessage("PENDING_BY_USER", "BB10")).toContain("aguardando pagamento");
  });

  it("não deixa o preço abaixo da cobrança mínima (R$ 5,00)", () => {
    const hundred = { ...base, discountValue: 100 };
    expect(checkCoupon({ coupon: hundred, target: product, now: NOW, redemptions: noUses })).toEqual({ ok: false, reason: "BELOW_MINIMUM" });
    const fixed = { ...base, discountType: "AMOUNT" as const, discountValue: 19200 };
    expect(checkCoupon({ coupon: fixed, target: product, now: NOW, redemptions: noUses })).toEqual({ ok: true, discountCents: 19200, finalPriceCents: 500 });
  });
});

describe("textos", () => {
  it("mensagens de recusa e descrição do desconto", () => {
    expect(couponRejectionMessage("ALREADY_USED", "BEMVINDO10")).toBe("Você já usou o cupom BEMVINDO10.");
    expect(couponRejectionMessage("BELOW_MINIMUM", "X")).toContain("R$ 5,00");
    expect(describeDiscount("PERCENT", 10)).toBe("10% de desconto");
    expect(describeDiscount("AMOUNT", 2000)).toBe("R$ 20,00 de desconto");
  });
});
