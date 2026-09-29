/**
 * page.tsx — SIMULADOR de pagamento: /dev/pagamentos/[id]  (só desenvolvimento; exige login)
 *
 * Quem chama: o provedor SIMULADO usa esta página como "página de pagamento" (no lugar da fatura
 * do Asaas). Só existe fora de produção; em produção responde "não encontrada".
 *
 * Cada botão faz o "Asaas simulado" mandar um AVISO (pago, vencida, estornada, contestada...), que
 * passa pelo MESMO processamento dos avisos reais. Assim dá para testar o fluxo inteiro de venda
 * sem conta no Asaas e sem dinheiro.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/admin/action-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { hasMinimumRole } from "@/modules/auth/roles";
import { requireSession } from "@/modules/auth/session";
import { PaymentStatusBadge } from "@/modules/payments/components/status-badge";
import { formatDateOnly } from "@/modules/payments/dates";
import { simulateNextCycleFormAction, simulatePaymentFormAction } from "@/modules/payments/dev-actions";
import { PAYMENT_METHOD_LABELS } from "@/modules/payments/labels";
import { formatBRL } from "@/modules/payments/money";

export const metadata: Metadata = {
  title: "Simulador de pagamento",
  robots: { index: false },
};

const BUTTONS = [
  { action: "PAY", label: "Pagar (aprovar)", variant: "default" },
  { action: "OVERDUE", label: "Vencer", variant: "outline" },
  { action: "REFUND", label: "Concluir estorno", variant: "outline" },
  { action: "REFUND_DENIED", label: "Negar estorno", variant: "outline" },
  { action: "CHARGEBACK", label: "Contestação no cartão", variant: "outline" },
  { action: "DELETE", label: "Remover cobrança", variant: "outline" },
] as const;

export default async function PaymentSimulatorPage({ params }: PageProps<"/dev/pagamentos/[providerPaymentId]">) {
  if (env.NODE_ENV === "production") notFound();
  const { providerPaymentId } = await params;
  const { user } = await requireSession(`/dev/pagamentos/${providerPaymentId}`);

  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId: decodeURIComponent(providerPaymentId) },
    include: {
      order: { select: { userId: true, productTitle: true } },
      subscription: { select: { id: true, userId: true, planTitle: true, status: true } },
    },
  });
  const ownerId = payment?.order?.userId ?? payment?.subscription?.userId;
  if (!payment || payment.provider !== "FAKE" || (ownerId !== user.id && !hasMinimumRole(user.role, "ADMIN"))) {
    notFound();
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <Alert>
        <AlertTitle>Simulador de pagamento (desenvolvimento)</AlertTitle>
        <AlertDescription>
          Esta página faz o papel do Asaas: cada botão manda um aviso simulado, processado exatamente como um aviso real.
          Nada aqui existe em produção.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{payment.order?.productTitle ?? payment.subscription?.planTitle}</CardTitle>
            <PaymentStatusBadge status={payment.status} />
          </div>
          <CardDescription>
            {formatBRL(payment.valueCents)} · {PAYMENT_METHOD_LABELS[payment.method]}
            {payment.installmentNumber ? ` · parcela ${payment.installmentNumber}` : ""} · vence em{" "}
            {formatDateOnly(payment.dueDate)} · <code className="text-xs">{payment.providerPaymentId}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-start gap-2">
            {BUTTONS.map((button) => (
              <ActionButton
                key={button.action}
                action={simulatePaymentFormAction}
                fields={{ paymentId: payment.id, action: button.action }}
                variant={button.variant}
                size="sm"
              >
                {button.label}
              </ActionButton>
            ))}
          </div>
          {payment.subscription && payment.subscription.status !== "CANCELED" ? (
            <div className="grid gap-1">
              <ActionButton action={simulateNextCycleFormAction} fields={{ subscriptionId: payment.subscription.id }} variant="secondary" size="sm">
                Gerar a cobrança do próximo ciclo
              </ActionButton>
              <p className="text-muted-foreground text-xs">
                Como o Asaas faz antes de cada vencimento. A nova cobrança aparece em &quot;Minhas compras&quot;.
              </p>
            </div>
          ) : null}
          <p className="text-sm">
            <Link href={`/area-do-aluno/pagamentos/${payment.id}`} className="underline">
              Voltar para a página de pagamento
            </Link>{" "}
            ·{" "}
            <Link href="/area-do-aluno/compras" className="underline">
              Minhas compras
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
