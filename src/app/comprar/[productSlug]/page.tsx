/**
 * page.tsx — Checkout de um produto: /comprar/[produto]  (exige login)
 *
 * Quem chama: o Next.js (botão "Comprar" na página do curso).
 * Mostra o resumo do produto (cursos, preço, parcelas, tempo de acesso) e o formulário de compra.
 * Com `?cupom=CODIGO` (Fase 6): confere o cupom e mostra o preço com desconto (o checkout confere
 * de novo ao enviar). Depois de enviar, o aluno vai para a página "como pagar" (Pix, boleto ou cartão).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/modules/auth/session";
import { COUPON_PARAM, CouponBox } from "@/modules/coupons/components/coupon-box";
import { previewCoupon } from "@/modules/coupons/coupons.server";
import { getBillingDefaults } from "@/modules/payments/checkout.server";
import { CheckoutForm } from "@/modules/payments/components/checkout-form";
import { PAYMENT_METHOD_LABELS, accessDaysLabel } from "@/modules/payments/labels";
import { formatBRL, installmentOptions } from "@/modules/payments/money";
import { getPaymentsSetup } from "@/modules/payments/provider/provider.server";
import { getProductForCheckout, listPendingOrdersForProduct } from "@/modules/payments/storefront.server";

export const metadata: Metadata = {
  title: "Comprar",
  robots: { index: false },
};

export default async function BuyProductPage({ params, searchParams }: PageProps<"/comprar/[productSlug]">) {
  const { productSlug } = await params;
  const couponParam = (await searchParams)[COUPON_PARAM];
  const couponInput = typeof couponParam === "string" && couponParam.trim() ? couponParam : null;
  const pagePath = `/comprar/${productSlug}`;
  // O login volta para esta página COM o cupom (links de edital/afiliado podem trazer um).
  const { user } = await requireSession(couponInput ? `${pagePath}?${COUPON_PARAM}=${encodeURIComponent(couponInput)}` : pagePath);
  const product = await getProductForCheckout(productSlug);
  if (!product) notFound();

  const coupon = couponInput
    ? await previewCoupon({ code: couponInput, target: { kind: "PRODUCT", id: product.id, priceCents: product.priceCents }, userId: user.id })
    : null;
  const priceCents = coupon?.ok ? coupon.finalPriceCents : product.priceCents;

  const [defaults, pendingOrders] = await Promise.all([
    getBillingDefaults(user.id),
    listPendingOrdersForProduct(user.id, product.id),
  ]);
  const setup = getPaymentsSetup();
  const options = installmentOptions(priceCents, product.maxInstallments).map((option) => ({
    count: option.count,
    label: option.count === 1 ? `À vista: ${formatBRL(priceCents)}` : `${option.count}x de ${formatBRL(option.valueCents)}`,
  }));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Comprar: {product.title}</h1>
        <p className="text-muted-foreground text-sm">O acesso é liberado assim que o pagamento é confirmado.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {coupon?.ok ? (
              <>
                <span className="text-muted-foreground mr-2 text-base font-normal line-through">{formatBRL(product.priceCents)}</span>
                {formatBRL(priceCents)}
              </>
            ) : (
              formatBRL(product.priceCents)
            )}
          </CardTitle>
          <CardDescription>
            Acesso {product.accessDays === null ? "" : "por "}
            {accessDaysLabel(product.accessDays)} a partir do pagamento
            {options.length > 1 ? ` · até ${options.at(-1)?.label} sem juros no cartão` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {product.description ? <p className="leading-relaxed">{product.description}</p> : null}
          <p className="font-medium">Inclui:</p>
          <ul className="list-disc pl-5">
            {product.courses.map(({ course }) => (
              <li key={course.id}>
                {course.isPublished ? (
                  <Link href={`/cursos/${course.slug}`} className="hover:underline">
                    {course.title}
                  </Link>
                ) : (
                  <>{course.title} (em breve)</>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {pendingOrders.length > 0 ? (
        <Alert>
          <AlertTitle>Você já tem um pedido deste produto aguardando pagamento</AlertTitle>
          <AlertDescription>
            {pendingOrders.map((order) =>
              order.payments[0] ? (
                <Link key={order.id} href={`/area-do-aluno/pagamentos/${order.payments[0].id}`} className="underline">
                  Pagar o pedido de {formatDate(order.createdAt)} ({PAYMENT_METHOD_LABELS[order.method]})
                </Link>
              ) : null,
            )}
            <span>Ou gere um novo abaixo (por exemplo, para pagar de outra forma).</span>
          </AlertDescription>
        </Alert>
      ) : null}

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
              kind="product"
              slug={product.slug}
              installmentOptions={options}
              defaults={defaults}
              submitLabel="Ir para o pagamento"
              couponCode={coupon?.ok ? coupon.code : null}
            />
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertTitle>Vendas temporariamente desligadas</AlertTitle>
          <AlertDescription>Tente de novo mais tarde.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
