/**
 * coupons-admin.server.ts — Cupons no painel (só ADMIN): listar, criar/editar, desativar e apagar.
 *
 * Quem chama: as ações de `actions.ts` e as páginas /admin/vendas/cupons. Os testes de integração
 * chamam direto.
 *
 * Regras:
 *  - O código é único. Depois de aparecer numa venda (qualquer pedido/assinatura, mesmo vencido), o
 *    código não muda (o pedido guarda o código; para outro código, crie outro cupom).
 *  - Editar e apagar usam a MESMA trava do checkout (`coupon:<id>`): uma compra com o cupom que está
 *    sendo gravada naquele instante termina antes, e a conferência já a enxerga.
 *  - Cupom usado não se apaga (a chave estrangeira do pedido impede): desative.
 *  - Mudar o desconto não altera vendas feitas: cada pedido guarda o desconto que teve.
 *  - Datas: o cupom vale do COMEÇO do dia inicial até o FIM do dia final (dias de Brasília).
 */
import "server-only";

import { isUniqueViolation } from "@/lib/db-errors";
import { advisoryLock } from "@/lib/db-locks";
import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";
import { addDays, startOfDayInSaoPaulo, toSaoPauloDate } from "@/modules/payments/dates";

import { countRedemptions, redemptionWhere } from "./coupons.server";
import type { CouponFormData } from "./schemas";

/** Datas do formulário (dias) → instantes de começo e fim (fim exclusivo: 00:00 do dia seguinte). */
function periodFromDays(startsOn: string | null, endsOn: string | null): { startsAt: Date | null; endsAt: Date | null } {
  return {
    startsAt: startsOn ? startOfDayInSaoPaulo(startsOn) : null,
    endsAt: endsOn ? startOfDayInSaoPaulo(addDays(endsOn, 1)) : null,
  };
}

/** Instantes gravados → dias para o formulário (o inverso de `periodFromDays`). */
export function daysFromPeriod(startsAt: Date | null, endsAt: Date | null): { startsOn: string; endsOn: string } {
  return {
    startsOn: startsAt ? toSaoPauloDate(startsAt) : "",
    endsOn: endsAt ? toSaoPauloDate(new Date(endsAt.getTime() - 1)) : "",
  };
}

export async function listCouponsForAdmin() {
  // Uma consulta só: o banco conta, junto com cada cupom, os pedidos e assinaturas que contam como uso
  // (mesma regra do checkout, `redemptionWhere`) — sem uma consulta por cupom.
  const coupons = await prisma.coupon.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: {
      affiliate: { select: { code: true } },
      _count: {
        select: {
          products: true,
          plans: true,
          orders: { where: redemptionWhere.order },
          subscriptions: { where: redemptionWhere.subscription },
        },
      },
    },
  });
  return coupons.map((coupon) => ({ ...coupon, redemptions: coupon._count.orders + coupon._count.subscriptions }));
}

/** Um cupom com as restrições e as últimas vendas que o usaram. */
export async function getCouponForAdmin(couponId: string) {
  const coupon = await prisma.coupon.findUnique({
    where: { id: couponId },
    include: {
      products: { select: { productId: true } },
      plans: { select: { planId: true } },
      affiliate: { select: { id: true, code: true } },
    },
  });
  if (!coupon) return null;
  const [redemptions, orders, subscriptions] = await Promise.all([
    countRedemptions(prisma, coupon.id, null),
    prisma.order.findMany({
      where: { couponId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, productTitle: true, priceCents: true, discountCents: true, status: true, createdAt: true, user: { select: { email: true } } },
    }),
    prisma.subscription.findMany({
      where: { couponId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, planTitle: true, priceCents: true, discountCents: true, status: true, createdAt: true, user: { select: { email: true } } },
    }),
  ]);
  return { ...coupon, redemptions: redemptions.total, orders, subscriptions };
}

/** O que o formulário oferece: produtos, planos e afiliados. */
export async function listCouponFormOptions() {
  const [products, plans, affiliates] = await Promise.all([
    prisma.product.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, isActive: true } }),
    prisma.plan.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, isActive: true } }),
    prisma.affiliate.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, isActive: true, user: { select: { name: true } } } }),
  ]);
  return { products, plans, affiliates };
}

/**
 * Cria ou edita um cupom.
 * Passos (numa transação): confere os produtos/planos/afiliado escolhidos; na edição, pega a trava do
 * cupom (a mesma do checkout) e recusa trocar o código de um cupom que já aparece em alguma venda;
 * grava o cupom e troca as restrições.
 */
export async function saveCoupon(data: CouponFormData): Promise<{ id: string }> {
  const fields = {
    code: data.code,
    description: data.description,
    discountType: data.discountType,
    discountValue: data.discountValue,
    appliesToProducts: data.appliesToProducts,
    appliesToPlans: data.appliesToPlans,
    ...periodFromDays(data.startsOn, data.endsOn),
    maxRedemptions: data.maxRedemptions,
    maxPerUser: data.maxPerUser,
    affiliateId: data.affiliateId,
    isActive: data.isActive,
  };
  try {
    return await prisma.$transaction(async (tx) => {
      const [products, plans, affiliate] = await Promise.all([
        tx.product.count({ where: { id: { in: data.productIds } } }),
        tx.plan.count({ where: { id: { in: data.planIds } } }),
        data.affiliateId ? tx.affiliate.count({ where: { id: data.affiliateId } }) : 1,
      ]);
      if (products !== data.productIds.length || plans !== data.planIds.length) {
        throw new UserFacingError("Algum produto ou plano escolhido não existe mais. Recarregue a página.");
      }
      if (affiliate === 0) throw new UserFacingError("Afiliado não encontrado.", { field: "affiliateId" });

      let couponId = data.couponId;
      if (couponId) {
        // A mesma trava do checkout (`reserveCoupon`): uma compra com este cupom em andamento termina
        // antes, e o pedido dela já aparece na conferência abaixo.
        await advisoryLock(tx, `coupon:${couponId}`);
        const current = await tx.coupon.findUnique({
          where: { id: couponId },
          select: { code: true, _count: { select: { orders: true, subscriptions: true } } },
        });
        if (!current) throw new UserFacingError("Cupom não encontrado.");
        if (current.code !== data.code && current._count.orders + current._count.subscriptions > 0) {
          throw new UserFacingError("Este cupom já aparece em vendas: o código não muda. Para outro código, crie outro cupom.", { field: "code" });
        }
        await tx.coupon.update({ where: { id: couponId }, data: fields });
        await tx.couponProduct.deleteMany({ where: { couponId } });
        await tx.couponPlan.deleteMany({ where: { couponId } });
      } else {
        couponId = (await tx.coupon.create({ data: fields, select: { id: true } })).id;
      }
      const id = couponId;
      await tx.couponProduct.createMany({ data: data.productIds.map((productId) => ({ couponId: id, productId })) });
      await tx.couponPlan.createMany({ data: data.planIds.map((planId) => ({ couponId: id, planId })) });
      return { id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Já existe um cupom com este código.", { field: "code" });
    throw error;
  }
}

export async function setCouponActive(couponId: string, isActive: boolean): Promise<void> {
  const { count } = await prisma.coupon.updateMany({ where: { id: couponId }, data: { isActive } });
  if (count === 0) throw new UserFacingError("Cupom não encontrado.");
}

/**
 * Apaga um cupom que NUNCA foi usado numa venda (nem em pedido cancelado). Conferência e apagar
 * num comando só (`deleteMany` com a condição "sem pedido e sem assinatura"), depois da trava do
 * cupom: uma compra com ele em andamento termina antes (e então o cupom não se apaga).
 */
export async function deleteCoupon(couponId: string): Promise<void> {
  const { count } = await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `coupon:${couponId}`);
    return tx.coupon.deleteMany({ where: { id: couponId, orders: { none: {} }, subscriptions: { none: {} } } });
  });
  if (count === 0) {
    throw new UserFacingError("Este cupom já aparece em vendas (ou não existe mais): desative em vez de apagar.");
  }
}
