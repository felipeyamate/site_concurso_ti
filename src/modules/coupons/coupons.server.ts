/**
 * coupons.server.ts — Cupons no checkout: buscar o cupom, contar os usos e "reservar" um uso.
 *
 * Quem chama: o checkout (`payments/checkout.server.ts`) e as páginas de compra/assinatura (para
 * mostrar o preço com desconto). As regras em si ficam em `rules.ts` (arquivo puro).
 *
 * Quando um uso "conta":
 *  - pedido PAGO com o cupom — inclusive se depois foi reembolsado ou contestado (senão: comprar com
 *    cupom, pedir reembolso e comprar de novo com o mesmo cupom);
 *  - pedido AGUARDANDO pagamento: é uma "reserva" (senão o aluno geraria vários Pix com o mesmo cupom e
 *    pagaria todos). Pix e cartão vencem em 1 dia, boleto em 3: a reserva dura pouco;
 *  - pedido VENCIDO sem pagamento ou cancelado NÃO conta: o uso volta (o aluno que desistiu do Pix pode
 *    usar o cupom de novo). Se um boleto vencido for pago mesmo assim, ele volta a contar — o limite
 *    pode passar em 1 nesse caso raro (aceito);
 *  - assinatura: com algum ciclo pago (conta para sempre, como o pedido) ou ainda sem pagamento e sem
 *    cobrança vencida/cancelada (reserva) — inclusive ANTES de a 1ª cobrança ser gravada: a assinatura
 *    é criada aqui (com a trava) e a cobrança só chega depois da resposta do provedor (ou do aviso).
 *    Criada com erro no provedor ou cancelada sem pagamento não conta.
 *
 * A trava: "o cupom ainda tem uso? → cria o pedido" é um "confere e grava" (regra do CLAUDE.md).
 * `reserveCoupon` trava o cupom (`coupon:<id>`) dentro da MESMA transação que cria o pedido: dois
 * alunos disputando o último uso passam um de cada vez, e o segundo já vê o uso do primeiro.
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { advisoryLock } from "@/lib/db-locks";
import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";
import type { AffiliateRef } from "@/modules/affiliates/rules";

import {
  checkCoupon,
  couponRejectionMessage,
  normalizeCouponCode,
  type CouponRedemptions,
  type CouponRules,
  type CouponTarget,
} from "./rules";

type Db = Prisma.TransactionClient;

export type CouponRecord = CouponRules & { id: string; affiliate: AffiliateRef | null };

const couponSelect = {
  id: true,
  code: true,
  discountType: true,
  discountValue: true,
  appliesToProducts: true,
  appliesToPlans: true,
  startsAt: true,
  endsAt: true,
  maxRedemptions: true,
  maxPerUser: true,
  isActive: true,
  products: { select: { productId: true } },
  plans: { select: { planId: true } },
  affiliate: { select: { id: true, userId: true, commissionBps: true, isActive: true } },
} as const satisfies Prisma.CouponSelect;

/** O cupom pelo código (já normalizado) no formato das regras, ou null. */
export async function findCoupon(db: Db, code: string): Promise<CouponRecord | null> {
  const coupon = await db.coupon.findUnique({ where: { code: normalizeCouponCode(code) }, select: couponSelect });
  if (!coupon) return null;
  const { products, plans, ...rest } = coupon;
  return { ...rest, productIds: products.map((item) => item.productId), planIds: plans.map((item) => item.planId) };
}

// Pedido que já foi pago (mesmo que depois reembolsado/contestado) e pedido ainda aguardando pagamento.
const PAID_ORDER_STATUSES = ["PAID", "REFUND_REQUESTED", "REFUNDED", "CHARGEBACK"] as const;
const paidOrder: Prisma.OrderWhereInput = { status: { in: [...PAID_ORDER_STATUSES] } };
const pendingOrder: Prisma.OrderWhereInput = { status: "PENDING" };
// Assinatura com algum ciclo pago; ou, sem nenhum, ainda em aberto: não cancelada e sem cobrança
// vencida/cancelada — o que inclui a assinatura recém-criada, que ainda não tem cobrança gravada.
const paidSubscription: Prisma.SubscriptionWhereInput = { failureReason: null, payments: { some: { paidAt: { not: null } } } };
const pendingSubscription: Prisma.SubscriptionWhereInput = {
  failureReason: null,
  status: { not: "CANCELED" },
  payments: { none: { OR: [{ paidAt: { not: null } }, { status: { in: ["OVERDUE", "CANCELED"] } }] } },
};

/** Onde (pedidos e assinaturas) um cupom conta como usado — ver o cabeçalho. Usado também pelas listas do painel. */
export const redemptionWhere = {
  order: { OR: [paidOrder, pendingOrder] } satisfies Prisma.OrderWhereInput,
  subscription: { OR: [paidSubscription, pendingSubscription] } satisfies Prisma.SubscriptionWhereInput,
};

/** Usos que contam: no total, deste aluno e quantos do aluno são reservas (aguardando pagamento). */
export async function countRedemptions(db: Db, couponId: string, userId: string | null): Promise<CouponRedemptions> {
  const [orders, subscriptions, userOrders, userSubscriptions, userPendingOrders, userPendingSubscriptions] = await Promise.all([
    db.order.count({ where: { couponId, ...redemptionWhere.order } }),
    db.subscription.count({ where: { couponId, ...redemptionWhere.subscription } }),
    userId ? db.order.count({ where: { couponId, userId, ...redemptionWhere.order } }) : 0,
    userId ? db.subscription.count({ where: { couponId, userId, ...redemptionWhere.subscription } }) : 0,
    userId ? db.order.count({ where: { couponId, userId, ...pendingOrder } }) : 0,
    userId ? db.subscription.count({ where: { couponId, userId, ...pendingSubscription } }) : 0,
  ]);
  return {
    total: orders + subscriptions,
    byUser: userOrders + userSubscriptions,
    pendingByUser: userPendingOrders + userPendingSubscriptions,
  };
}

export type CouponPreview =
  | { ok: true; code: string; discountCents: number; finalPriceCents: number }
  | { ok: false; code: string; message: string };

/**
 * Prévia para a página de compra ("com o cupom X, fica R$ Y"). SEM trava: é só para mostrar —
 * o checkout confere de novo, com a trava, na hora de criar o pedido (`reserveCoupon`).
 */
export async function previewCoupon(input: { code: string; target: CouponTarget; userId: string | null; now?: Date }): Promise<CouponPreview> {
  const code = normalizeCouponCode(input.code);
  const coupon = await findCoupon(prisma, code);
  const redemptions = coupon ? await countRedemptions(prisma, coupon.id, input.userId) : { total: 0, byUser: 0 };
  const result = checkCoupon({ coupon, target: input.target, now: input.now ?? new Date(), redemptions });
  if (!result.ok) return { ok: false, code, message: couponRejectionMessage(result.reason, code) };
  return { ok: true, code, discountCents: result.discountCents, finalPriceCents: result.finalPriceCents };
}

/**
 * Confere o cupom COM a trava dele, dentro da transação que vai criar o pedido/assinatura.
 * Devolve o cupom e os valores; se não valer, lança o erro para o aluno (no campo do cupom).
 */
export async function reserveCoupon(
  tx: Db,
  input: { code: string; target: CouponTarget; userId: string; now: Date },
): Promise<{ coupon: CouponRecord; discountCents: number; finalPriceCents: number }> {
  const code = normalizeCouponCode(input.code);
  const found = await findCoupon(tx, code);
  if (found) await advisoryLock(tx, `coupon:${found.id}`);
  // Relê depois da trava: o cupom pode ter sido desativado/alterado enquanto esperávamos.
  const coupon = found ? await findCoupon(tx, code) : null;
  const redemptions = coupon ? await countRedemptions(tx, coupon.id, input.userId) : { total: 0, byUser: 0 };
  const result = checkCoupon({ coupon, target: input.target, now: input.now, redemptions });
  if (!result.ok || !coupon) {
    throw new UserFacingError(couponRejectionMessage(result.ok ? "NOT_FOUND" : result.reason, code), { field: "couponCode" });
  }
  return { coupon, discountCents: result.discountCents, finalPriceCents: result.finalPriceCents };
}
