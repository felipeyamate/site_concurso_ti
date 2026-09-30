/**
 * rules.ts — Regras dos cupons de desconto: o cupom vale para esta compra? Quanto desconta?
 *
 * Quem chama: o checkout (`coupons.server.ts`, que busca o cupom e os usos no banco e depois
 * confere aqui), as páginas de compra (para mostrar o preço com desconto) e o painel.
 * Arquivo "puro" (sem banco), testado em `rules.test.ts`.
 *
 * Regras:
 *  - O código não diferencia maiúsculas/minúsculas (guardamos em MAIÚSCULAS).
 *  - Percentual (1 a 100%) ou valor fixo (centavos); o desconto nunca passa do preço.
 *  - Vale em compras avulsas e/ou assinaturas; uma lista de produtos/planos pode restringir.
 *  - Período de validade, limite de usos no total e por aluno.
 *  - O preço final não pode ficar abaixo da cobrança mínima (R$ 5,00): cobrança de R$ 0 não
 *    existe no provedor, e acesso de graça é matrícula manual (painel), nunca "compra".
 */
import type { CouponDiscountType } from "@/generated/prisma/enums";

import { MIN_CHARGE_CENTS, formatBRL } from "@/modules/payments/money";

export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;

export type CouponRules = {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  appliesToProducts: boolean;
  appliesToPlans: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  maxRedemptions: number | null;
  maxPerUser: number;
  isActive: boolean;
  // Restrições: vazio = todos os produtos/planos (se o tipo estiver liberado acima).
  productIds: string[];
  planIds: string[];
};

export type CouponTarget = { kind: "PRODUCT" | "PLAN"; id: string; priceCents: number };

export type CouponRejection =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "NOT_APPLICABLE"
  | "SOLD_OUT"
  | "ALREADY_USED"
  | "PENDING_BY_USER"
  | "BELOW_MINIMUM";

export type CouponCheck =
  | { ok: true; discountCents: number; finalPriceCents: number }
  | { ok: false; reason: CouponRejection };

/** " bem-vindo10 " → "BEM-VINDO10" (o aluno digita como quiser). */
export function normalizeCouponCode(input: string): string {
  return input.trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * Quanto o cupom desconta deste preço (em centavos).
 * Percentual: arredonda para o centavo mais próximo (ex.: 15% de R$ 49,90 = R$ 7,49).
 * Valor fixo: no máximo o próprio preço.
 */
export function computeDiscountCents(type: CouponDiscountType, value: number, priceCents: number): number {
  const raw = type === "PERCENT" ? Math.round((priceCents * value) / 100) : value;
  return Math.max(0, Math.min(raw, priceCents));
}

function appliesTo(coupon: CouponRules, target: CouponTarget): boolean {
  if (target.kind === "PRODUCT") {
    return coupon.appliesToProducts && (coupon.productIds.length === 0 || coupon.productIds.includes(target.id));
  }
  return coupon.appliesToPlans && (coupon.planIds.length === 0 || coupon.planIds.includes(target.id));
}

/**
 * Usos que já contam: `total` (todos os alunos) e `byUser` (este aluno), ambos INCLUINDO os pedidos
 * ainda aguardando pagamento ("reserva"); `pendingByUser` = quantos dos usos do aluno são essas reservas
 * (só para escolher a mensagem certa).
 */
export type CouponRedemptions = { total: number; byUser: number; pendingByUser?: number };

/**
 * O cupom vale para esta compra? Devolve o desconto e o preço final, ou o motivo da recusa.
 * `redemptions`: usos que já contam — quem chama busca no banco, COM a trava do cupom, para dois
 * alunos não passarem juntos pelo último uso.
 */
export function checkCoupon(input: {
  coupon: CouponRules | null;
  target: CouponTarget;
  now: Date;
  redemptions: CouponRedemptions;
}): CouponCheck {
  const { coupon, target, now, redemptions } = input;
  if (!coupon) return { ok: false, reason: "NOT_FOUND" };
  if (!coupon.isActive) return { ok: false, reason: "INACTIVE" };
  if (coupon.startsAt && now < coupon.startsAt) return { ok: false, reason: "NOT_STARTED" };
  if (coupon.endsAt && now >= coupon.endsAt) return { ok: false, reason: "EXPIRED" };
  if (!appliesTo(coupon, target)) return { ok: false, reason: "NOT_APPLICABLE" };
  // "Você já usou" vem antes de "esgotado": quando as duas valem, a primeira explica melhor.
  // Se o que falta é só um pedido do aluno ainda aguardando pagamento, a mensagem diz isso (ele pode
  // pagar esse pedido, ou esperar vencer — pedido vencido sem pagamento devolve o uso).
  if (redemptions.byUser >= coupon.maxPerUser) {
    const paidByUser = redemptions.byUser - (redemptions.pendingByUser ?? 0);
    return { ok: false, reason: paidByUser >= coupon.maxPerUser ? "ALREADY_USED" : "PENDING_BY_USER" };
  }
  if (coupon.maxRedemptions !== null && redemptions.total >= coupon.maxRedemptions) return { ok: false, reason: "SOLD_OUT" };

  const discountCents = computeDiscountCents(coupon.discountType, coupon.discountValue, target.priceCents);
  const finalPriceCents = target.priceCents - discountCents;
  if (finalPriceCents < MIN_CHARGE_CENTS) return { ok: false, reason: "BELOW_MINIMUM" };
  return { ok: true, discountCents, finalPriceCents };
}

/** A frase que o aluno vê quando o cupom não vale. */
export function couponRejectionMessage(reason: CouponRejection, code: string): string {
  switch (reason) {
    case "NOT_FOUND":
      return `O cupom ${code} não existe. Confira as letras e os números.`;
    case "INACTIVE":
    case "EXPIRED":
      return `O cupom ${code} não está mais valendo.`;
    case "NOT_STARTED":
      return `O cupom ${code} ainda não começou a valer.`;
    case "NOT_APPLICABLE":
      return `O cupom ${code} não vale para esta compra.`;
    case "SOLD_OUT":
      return `O cupom ${code} já foi usado o número máximo de vezes.`;
    case "ALREADY_USED":
      return `Você já usou o cupom ${code}.`;
    case "PENDING_BY_USER":
      return `Você já tem um pedido com o cupom ${code} aguardando pagamento: pague esse pedido (em "Minhas compras") ou espere ele vencer para usar o cupom de novo.`;
    case "BELOW_MINIMUM":
      return `O cupom ${code} deixaria o valor abaixo do mínimo de cobrança (${formatBRL(MIN_CHARGE_CENTS)}).`;
  }
}

/** "10% de desconto" / "R$ 20,00 de desconto". */
export function describeDiscount(type: CouponDiscountType, value: number): string {
  return type === "PERCENT" ? `${value}% de desconto` : `${formatBRL(value)} de desconto`;
}
