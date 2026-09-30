/**
 * page.tsx — Checkout de uma assinatura: /assinar/[plano]  (exige login)
 *
 * Quem chama: o Next.js (botão "Assinar" em /planos).
 * Mostra o plano (preço por ciclo, o que inclui) e o formulário. Com `?cupom=CODIGO` (Fase 6),
 * mostra o preço com desconto — que vale em TODAS as renovações. Depois de enviar, o aluno vai
 * para a página "como pagar" da 1ª cobrança. No cartão, as próximas cobranças são automáticas.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/modules/auth/session";
import { COUPON_PARAM, CouponBox } from "@/modules/coupons/components/coupon-box";
import { previewCoupon } from "@/modules/coupons/coupons.server";
import { getBillingDefaults } from "@/modules/payments/checkout.server";
import { CheckoutForm } from "@/modules/payments/components/checkout-form";
import { PLAN_CYCLE_LABELS, PLAN_CYCLE_PERIOD } from "@/modules/payments/labels";
import { formatBRL } from "@/modules/payments/money";
import { getPaymentsSetup } from "@/modules/payments/provider/provider.server";
import { getPlanForCheckout } from "@/modules/payments/storefront.server";

export const metadata: Metadata = {
  title: "Assinar",
  robots: { index: false },
};

export default async function SubscribePage({ params, searchParams }: PageProps<"/assinar/[planSlug]">) {
  const { planSlug } = await params;
  const couponParam = (await searchParams)[COUPON_PARAM];
  const couponInput = typeof couponParam === "string" && couponParam.trim() ? couponParam : null;
  const pagePath = `/assinar/${planSlug}`;
  const { user } = await requireSession(couponInput ? `${pagePath}?${COUPON_PARAM}=${encodeURIComponent(couponInput)}` : pagePath);
  const plan = await getPlanForCheckout(planSlug);
  if (!plan) notFound();

  const coupon = couponInput
    ? await previewCoupon({ code: couponInput, target: { kind: "PLAN", id: plan.id, priceCents: plan.priceCents }, userId: user.id })
    : null;

  const defaults = await getBillingDefaults(user.id);
  const setup = getPaymentsSetup();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <Link href="/planos" className="text-muted-foreground text-sm hover:underline">
          ← Planos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Assinar: {plan.title}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {coupon?.ok ? (
              <span className="text-muted-foreground mr-2 text-base font-normal line-through">{formatBRL(plan.priceCents)}</span>
            ) : null}
            {formatBRL(coupon?.ok ? coupon.finalPriceCents : plan.priceCents)}{" "}
            <span className="text-muted-foreground text-base font-normal">{PLAN_CYCLE_PERIOD[plan.cycle]}</span>
          </CardTitle>
          <CardDescription>
            {PLAN_CYCLE_LABELS[plan.cycle]} · todos os cursos incluídos na assinatura · cancele quando quiser
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {plan.description ? <p className="leading-relaxed">{plan.description}</p> : null}
          {coupon?.ok ? <p className="font-medium">Com o cupom, o desconto vale em todas as renovações da assinatura.</p> : null}
          <p className="text-muted-foreground">
            No cartão, as próximas cobranças são automáticas. No Pix e no boleto, a cobrança de cada ciclo chega por
            e-mail antes do vencimento. Cancelando, o acesso continua até o fim do período já pago.
          </p>
        </CardContent>
      </Card>

      {setup.enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Pagamento</CardTitle>
            {setup.kind === "FAKE" ? (
              <CardDescription>
                Modo de desenvolvimento: os pagamentos são SIMULADOS (nenhuma cobrança real é feita).
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-6">
            <CouponBox preview={coupon} pagePath={pagePath} />
            <CheckoutForm
              kind="plan"
              slug={plan.slug}
              installmentOptions={[]}
              defaults={defaults}
              submitLabel="Assinar e ir para o pagamento"
              couponCode={coupon?.ok ? coupon.code : null}
            />
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertTitle>Assinaturas temporariamente desligadas</AlertTitle>
          <AlertDescription>Tente de novo mais tarde.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
