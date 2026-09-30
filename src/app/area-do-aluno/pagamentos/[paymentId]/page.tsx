/**
 * page.tsx — Como pagar uma cobrança: /area-do-aluno/pagamentos/[id]  (exige login; só o dono)
 *
 * Quem chama: o Next.js (depois do checkout, e pelo botão "Pagar" em "Minhas compras").
 * Mostra, conforme a forma de pagamento:
 *  - Pix: QR Code + "copia e cola" (aqui mesmo);
 *  - Boleto: link do boleto em PDF;
 *  - Cartão: botão para a página segura do provedor (o cartão nunca é digitado no nosso site).
 * Enquanto aguarda, a página se atualiza sozinha: quando o AVISO do provedor chega, aparece
 * "pagamento confirmado". (Nunca liberamos acesso por esta página: só pelo aviso.)
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasMinimumRole } from "@/modules/auth/roles";
import { requireSession } from "@/modules/auth/session";
import { AutoRefresh } from "@/modules/payments/components/auto-refresh";
import { PixPayment } from "@/modules/payments/components/pix-payment";
import { formatDateOnly } from "@/modules/payments/dates";
import { PaymentStatusBadge } from "@/modules/payments/components/status-badge";
import { PAYMENT_METHOD_LABELS } from "@/modules/payments/labels";
import { formatBRL } from "@/modules/payments/money";
import { isPaidStatus, isReversedStatus } from "@/modules/payments/rules";
import { getPaymentForViewer } from "@/modules/payments/storefront.server";

export const metadata: Metadata = {
  title: "Pagamento",
  robots: { index: false },
};

export default async function PaymentPage({ params }: PageProps<"/area-do-aluno/pagamentos/[paymentId]">) {
  const { paymentId } = await params;
  // Como "Minhas compras": pagar (ou ver) uma cobrança já gerada não depende do aceite da versão nova dos Termos.
  const { user } = await requireSession(`/area-do-aluno/pagamentos/${paymentId}`, { allowPendingLegal: true });
  const payment = await getPaymentForViewer({
    paymentId,
    userId: user.id,
    isAdmin: hasMinimumRole(user.role, "ADMIN"),
  });
  // Cobrança de outra pessoa = "não encontrada" (não revela que existe).
  if (!payment) notFound();

  const itemTitle = payment.order?.productTitle ?? payment.subscription?.planTitle ?? "Compra";
  const waiting = payment.status === "PENDING" || payment.status === "OVERDUE";
  const paid = isPaidStatus(payment.status);
  const totalCents = payment.order ? payment.order.priceCents : payment.valueCents;
  const installments = payment.order?.installments ?? 1;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      {waiting ? <AutoRefresh /> : null}
      <div className="grid gap-1">
        <Link href="/area-do-aluno/compras" className="text-muted-foreground text-sm hover:underline">
          ← Minhas compras
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Pagamento: {itemTitle}</h1>
      </div>

      {paid ? (
        <Alert>
          <AlertTitle>Pagamento confirmado!</AlertTitle>
          <AlertDescription>
            <p>Seu acesso já está liberado. Bons estudos!</p>
            <Button asChild size="sm" className="w-fit">
              <Link href="/area-do-aluno">Ir para meus cursos</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {isReversedStatus(payment.status) ? (
        <Alert>
          <AlertTitle>Pagamento estornado ou contestado</AlertTitle>
          <AlertDescription>O acesso ligado a este pagamento foi encerrado. Dúvidas? Fale com o suporte.</AlertDescription>
        </Alert>
      ) : null}
      {payment.status === "CANCELED" ? (
        <Alert>
          <AlertTitle>Cobrança cancelada</AlertTitle>
          <AlertDescription>Esta cobrança não vale mais. Se ainda quiser comprar, faça um novo pedido.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-2xl">{formatBRL(totalCents)}</CardTitle>
            <PaymentStatusBadge status={payment.status} />
          </div>
          <CardDescription>
            {PAYMENT_METHOD_LABELS[payment.method]}
            {installments > 1 ? ` em ${installments}x de ${formatBRL(payment.valueCents)}` : ""} · vencimento{" "}
            {formatDateOnly(payment.dueDate)}
          </CardDescription>
        </CardHeader>
        {waiting ? (
          <CardContent className="grid gap-4">
            {payment.method === "PIX" && payment.pixPayload && payment.pixImage ? (
              <PixPayment image={payment.pixImage} payload={payment.pixPayload} />
            ) : null}
            {payment.method === "BOLETO" && payment.bankSlipUrl ? (
              <div className="grid gap-2 text-sm">
                <p>Pague o boleto no app do seu banco ou numa lotérica. A confirmação leva até 3 dias úteis.</p>
                <Button asChild className="w-fit">
                  <a href={payment.bankSlipUrl} target="_blank" rel="noreferrer">
                    Abrir o boleto
                  </a>
                </Button>
              </div>
            ) : null}
            {payment.method === "CREDIT_CARD" && payment.invoiceUrl ? (
              <div className="grid gap-2 text-sm">
                <p>Você vai digitar o cartão na página segura do nosso provedor de pagamentos (Asaas).</p>
                <Button asChild className="w-fit">
                  <a href={payment.invoiceUrl}>Pagar com cartão</a>
                </Button>
              </div>
            ) : null}
            {/* Plano B: a fatura do provedor aceita as formas de pagamento da cobrança. */}
            {payment.method !== "CREDIT_CARD" && payment.invoiceUrl ? (
              <p className="text-muted-foreground text-xs">
                Problemas?{" "}
                <a href={payment.invoiceUrl} target="_blank" rel="noreferrer" className="underline">
                  Abra a fatura
                </a>
                .
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs" role="status">
              Esta página se atualiza sozinha: quando o pagamento for confirmado, o acesso é liberado automaticamente.
            </p>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
