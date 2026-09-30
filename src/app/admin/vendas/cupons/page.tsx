/**
 * page.tsx — Cupons de desconto: /admin/vendas/cupons  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (submenu Vendas → Cupons).
 * Lista os cupons (desconto, onde valem, validade, usos) e cria um novo.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { requireRole } from "@/modules/auth/session";
import { CouponForm, EMPTY_COUPON } from "@/modules/coupons/components/coupon-form";
import { listCouponFormOptions, listCouponsForAdmin } from "@/modules/coupons/coupons-admin.server";
import { describeDiscount } from "@/modules/coupons/rules";

export const metadata: Metadata = {
  title: "Cupons · Painel admin",
  robots: { index: false },
};

export default async function AdminCouponsPage() {
  await requireRole("ADMIN", "/admin/vendas/cupons");
  const [coupons, options] = await Promise.all([listCouponsForAdmin(), listCouponFormOptions()]);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cupons</h1>
        <p className="text-muted-foreground text-sm">
          O aluno digita o cupom na página de compra — ou chega com ele no link (ex.: <code>/comprar/produto?cupom=CODIGO</code>).
        </p>
      </div>

      {coupons.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum cupom ainda.</p>
      ) : (
        <div className="grid gap-3">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-medium">{coupon.code}</span>
                  <Badge variant={coupon.isActive ? "default" : "secondary"}>{coupon.isActive ? "Ativo" : "Inativo"}</Badge>
                  {coupon.affiliate ? <Badge variant="outline">afiliado {coupon.affiliate.code}</Badge> : null}
                </div>
                <p className="text-muted-foreground text-sm">
                  {describeDiscount(coupon.discountType, coupon.discountValue)} ·{" "}
                  {[coupon.appliesToProducts ? "compras avulsas" : null, coupon.appliesToPlans ? "assinaturas" : null].filter(Boolean).join(" e ")}
                  {coupon._count.products + coupon._count.plans > 0 ? " (alguns)" : ""} · {coupon.redemptions}
                  {coupon.maxRedemptions ? ` de ${coupon.maxRedemptions}` : ""} uso(s)
                  {coupon.endsAt ? ` · até ${formatDate(new Date(coupon.endsAt.getTime() - 1))}` : ""}
                </p>
                {coupon.description ? <p className="text-muted-foreground text-xs">{coupon.description}</p> : null}
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/vendas/cupons/${coupon.id}`}>Editar</Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Novo cupom</CardTitle>
          <CardDescription>O código não diferencia maiúsculas de minúsculas para o aluno.</CardDescription>
        </CardHeader>
        <CardContent>
          <CouponForm
            coupon={EMPTY_COUPON}
            products={options.products}
            plans={options.plans}
            affiliates={options.affiliates.map((affiliate) => ({ id: affiliate.id, code: affiliate.code, name: affiliate.user.name, isActive: affiliate.isActive }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
