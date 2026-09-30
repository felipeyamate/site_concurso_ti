/**
 * page.tsx — Um cupom: /admin/vendas/cupons/[id]  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (lista de cupons → Editar).
 * Mostra: o formulário do cupom, ativar/desativar, apagar (só se nunca foi usado) e as vendas
 * que usaram o cupom (pedidos e assinaturas).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/admin/action-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/modules/auth/session";
import { deleteCouponAction, setCouponActiveAction } from "@/modules/coupons/actions";
import { CouponForm } from "@/modules/coupons/components/coupon-form";
import { daysFromPeriod, getCouponForAdmin, listCouponFormOptions } from "@/modules/coupons/coupons-admin.server";
import { OrderStatusBadge, SubscriptionStatusBadge } from "@/modules/payments/components/status-badge";
import { formatBRL, formatCentsForInput } from "@/modules/payments/money";

export const metadata: Metadata = {
  title: "Cupom · Painel admin",
  robots: { index: false },
};

export default async function AdminCouponPage({ params }: PageProps<"/admin/vendas/cupons/[couponId]">) {
  const { couponId } = await params;
  await requireRole("ADMIN", `/admin/vendas/cupons/${couponId}`);
  const [coupon, options] = await Promise.all([getCouponForAdmin(couponId), listCouponFormOptions()]);
  if (!coupon) notFound();
  const days = daysFromPeriod(coupon.startsAt, coupon.endsAt);
  const hasSales = coupon.orders.length + coupon.subscriptions.length > 0;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <Link href="/admin/vendas/cupons" className="text-muted-foreground text-sm hover:underline">
          ← Cupons
        </Link>
        <h1 className="font-mono text-2xl font-semibold tracking-tight">{coupon.code}</h1>
        <p className="text-muted-foreground text-sm">
          {coupon.redemptions}
          {coupon.maxRedemptions ? ` de ${coupon.maxRedemptions}` : ""} uso(s) que contam (pedidos não cancelados e assinaturas criadas).
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <CouponForm
            coupon={{
              id: coupon.id,
              code: coupon.code,
              description: coupon.description,
              discountType: coupon.discountType,
              percentOff: coupon.discountType === "PERCENT" ? String(coupon.discountValue) : "10",
              amountOff: coupon.discountType === "AMOUNT" ? formatCentsForInput(coupon.discountValue) : "",
              appliesToProducts: coupon.appliesToProducts,
              appliesToPlans: coupon.appliesToPlans,
              productIds: coupon.products.map((item) => item.productId),
              planIds: coupon.plans.map((item) => item.planId),
              startsOn: days.startsOn,
              endsOn: days.endsOn,
              maxRedemptions: coupon.maxRedemptions === null ? "" : String(coupon.maxRedemptions),
              maxPerUser: String(coupon.maxPerUser),
              affiliateId: coupon.affiliate?.id ?? "",
              isActive: coupon.isActive,
            }}
            products={options.products}
            plans={options.plans}
            affiliates={options.affiliates.map((affiliate) => ({ id: affiliate.id, code: affiliate.code, name: affiliate.user.name, isActive: affiliate.isActive }))}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <ActionButton action={setCouponActiveAction} fields={{ couponId: coupon.id, isActive: coupon.isActive ? "false" : "true" }} variant="outline">
          {coupon.isActive ? "Desativar cupom" : "Ativar cupom"}
        </ActionButton>
        {hasSales ? null : (
          <ActionButton action={deleteCouponAction} fields={{ couponId: coupon.id }} variant="destructive" confirmMessage="Apagar este cupom?">
            Apagar cupom
          </ActionButton>
        )}
      </div>

      {/* `min-w-0`: a tabela larga não estica o card nem a página no celular. */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Vendas com este cupom</CardTitle>
          <CardDescription>As 50 mais recentes de cada tipo.</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasSales ? (
            <p className="text-muted-foreground text-sm">Nenhuma venda usou este cupom ainda.</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Quando</th>
                    <th className="py-2 pr-3 font-medium">O quê</th>
                    <th className="py-2 pr-3 font-medium">Aluno</th>
                    <th className="py-2 pr-3 font-medium">Pago / desconto</th>
                    <th className="py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {coupon.orders.map((order) => (
                    <tr key={order.id} className="border-t">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(order.createdAt)}</td>
                      <td className="py-2 pr-3">
                        <Link href={`/admin/vendas/pedidos/${order.id}`} className="underline">
                          {order.productTitle}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{order.user.email}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatBRL(order.priceCents)} / −{formatBRL(order.discountCents)}
                      </td>
                      <td className="py-2">
                        <OrderStatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                  {coupon.subscriptions.map((subscription) => (
                    <tr key={subscription.id} className="border-t">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(subscription.createdAt)}</td>
                      <td className="py-2 pr-3">
                        <Link href={`/admin/vendas/assinaturas/${subscription.id}`} className="underline">
                          {subscription.planTitle}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{subscription.user.email}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatBRL(subscription.priceCents)} / −{formatBRL(subscription.discountCents)} por ciclo
                      </td>
                      <td className="py-2">
                        <SubscriptionStatusBadge status={subscription.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
