/**
 * offer-cards.tsx — Os cartões "como se preparar": um produto (compra avulsa) e/ou um plano
 * (assinatura), com o preço e o botão para o checkout.
 *
 * Quem chama: a página de concurso (/concursos/[slug], com o cupom da página já aplicado) e a página
 * da trilha (/trilhas/[slug], sem cupom).
 * O cupom só vem aqui quando ele VALE para aquela oferta hoje (quem chama já conferiu com
 * `previewCoupon`): aí o preço antigo aparece riscado e o botão leva `?cupom=` para o checkout, que
 * confere tudo de novo. Nada é cobrado nem liberado por esta página.
 */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COUPON_PARAM } from "@/modules/coupons/components/coupon-box";

import { PLAN_CYCLE_PERIOD, accessDaysLabel } from "../labels";
import { formatBRL } from "../money";

export type OfferCoupon = { code: string; finalPriceCents: number };

export type ProductOffer = {
  slug: string;
  title: string;
  priceCents: number;
  accessDays: number | null;
  maxInstallments: number;
  coupon?: OfferCoupon | null;
};

export type PlanOffer = { slug: string; title: string; priceCents: number; cycle: "MONTHLY" | "YEARLY"; coupon?: OfferCoupon | null };

// O link do checkout, com o cupom (quando ele vale para esta oferta).
function withCoupon(path: string, coupon: OfferCoupon | null | undefined): string {
  return coupon ? `${path}?${COUPON_PARAM}=${encodeURIComponent(coupon.code)}` : path;
}

export function OfferCards({ product, plan, label = "Como se preparar" }: { product: ProductOffer | null; plan: PlanOffer | null; label?: string }) {
  if (!product && !plan) return null;
  return (
    <section className="grid gap-4 sm:grid-cols-2" aria-label={label}>
      {product ? (
        <Card>
          <CardHeader>
            <CardTitle>{product.title}</CardTitle>
            <CardDescription>
              <OfferPrice priceCents={product.priceCents} coupon={product.coupon} /> · acesso {accessDaysLabel(product.accessDays)}
              {product.maxInstallments > 1 ? ` · até ${product.maxInstallments}x no cartão` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <CouponNote coupon={product.coupon} />
            <Button asChild>
              <Link href={withCoupon(`/comprar/${product.slug}`, product.coupon)}>Quero me preparar</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {plan ? (
        <Card>
          <CardHeader>
            <CardTitle>{plan.title}</CardTitle>
            <CardDescription>
              <OfferPrice priceCents={plan.priceCents} coupon={plan.coupon} /> {PLAN_CYCLE_PERIOD[plan.cycle]} · todos os cursos da assinatura
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <CouponNote coupon={plan.coupon} />
            <Button asChild variant={product ? "outline" : "default"}>
              <Link href={withCoupon(`/assinar/${plan.slug}`, plan.coupon)}>Assinar</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

/** Preço da oferta: com o cupom valendo, o antigo riscado e o novo. */
function OfferPrice({ priceCents, coupon }: { priceCents: number; coupon: OfferCoupon | null | undefined }) {
  if (!coupon) return <>{formatBRL(priceCents)}</>;
  return (
    <>
      <span className="line-through">{formatBRL(priceCents)}</span> <strong className="text-foreground">{formatBRL(coupon.finalPriceCents)}</strong>
    </>
  );
}

function CouponNote({ coupon }: { coupon: OfferCoupon | null | undefined }) {
  if (!coupon) return null;
  return (
    <p className="text-sm">
      Com o cupom <strong>{coupon.code}</strong> já aplicado.
    </p>
  );
}
