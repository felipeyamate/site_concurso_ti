/**
 * page.tsx — Uma assinatura no painel: /admin/vendas/assinaturas/[id]  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (botão "Abrir" na lista de assinaturas).
 * Mostra: aluno, plano (preço/ciclo da época), cada ciclo cobrado (com nota fiscal), o aviso de
 * estorno de boleto pendente e as ações: cancelar (o período pago continua) ou cancelar estornando
 * o último pagamento (escondido enquanto houver um estorno em andamento).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/admin/action-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/modules/auth/session";
import { adminCancelSubscriptionAction } from "@/modules/payments/admin/actions";
import { PaymentsTable } from "@/modules/payments/admin/components/payments-table";
import { getSubscriptionForAdmin } from "@/modules/payments/admin/sales-admin.server";
import { SubscriptionStatusBadge } from "@/modules/payments/components/status-badge";
import { PAYMENT_METHOD_LABELS, PLAN_CYCLE_PERIOD } from "@/modules/payments/labels";
import { formatBRL } from "@/modules/payments/money";

export const metadata: Metadata = {
  title: "Assinatura · Painel admin",
  robots: { index: false },
};

export default async function AdminSubscriptionPage({ params }: PageProps<"/admin/vendas/assinaturas/[subscriptionId]">) {
  const { subscriptionId } = await params;
  await requireRole("ADMIN", `/admin/vendas/assinaturas/${subscriptionId}`);
  const subscription = await getSubscriptionForAdmin(subscriptionId);
  if (!subscription) notFound();
  // Estorno à mão no painel do Asaas ainda não feito (boleto).
  const manualRefundPending = subscription.payments.some((payment) => payment.manualRefundRequestedAt);
  // Com um estorno em andamento, "cancelar e estornar" de novo estornaria outro pagamento.
  const refundInProgress = subscription.payments.some((payment) => payment.status === "REFUND_REQUESTED");

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <Link href="/admin/vendas/assinaturas" className="text-muted-foreground text-sm hover:underline">
          ← Assinaturas
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{subscription.planTitle}</h1>
          <SubscriptionStatusBadge status={subscription.status} />
        </div>
        <p className="text-muted-foreground text-sm">
          {formatBRL(subscription.priceCents)} {PLAN_CYCLE_PERIOD[subscription.cycle]} · {PAYMENT_METHOD_LABELS[subscription.method]} ·
          desde {formatDateTime(subscription.createdAt)}
          {subscription.canceledAt ? ` · cancelada em ${formatDateTime(subscription.canceledAt)}` : ""}
          {subscription.provider === "FAKE" ? " · SIMULADA" : ""}
        </p>
        <p className="text-sm">
          {subscription.user.name} ({subscription.user.email}) ·{" "}
          <Link href={`/admin/usuarios/${subscription.user.id}`} className="underline">
            ver usuário e matrículas
          </Link>
        </p>
      </div>

      {manualRefundPending ? (
        <Alert>
          <AlertTitle>Estorno de boleto pendente</AlertTitle>
          <AlertDescription>
            O acesso já foi retirado. Faça o estorno no painel do Asaas (ele pede os dados bancários do aluno). Quando o Asaas
            confirmar, a cobrança fica &quot;Reembolsada&quot; sozinha.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* `min-w-0`: sem isto, a tabela larga "estica" o card (item do grid) e a página rola para o lado no celular. */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Cobranças (um por ciclo)</CardTitle>
          <CardDescription>
            Cada ciclo pago libera os cursos da assinatura até o vencimento seguinte + 5 dias de tolerância (cancelada: até a
            véspera do vencimento seguinte).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentsTable payments={subscription.payments} />
        </CardContent>
      </Card>

      {subscription.status !== "CANCELED" ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Cancelar assinatura</CardTitle>
            <CardDescription>
              Cancelar: não gera novas cobranças; o período pago continua valendo. Cancelar e estornar: também devolve o último
              pagamento e retira o acesso dele.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-start gap-2">
            <ActionButton
              action={adminCancelSubscriptionAction}
              fields={{ subscriptionId: subscription.id }}
              variant="outline"
              confirmMessage={`Cancelar a assinatura de ${subscription.user.name}?`}
            >
              Cancelar
            </ActionButton>
            {refundInProgress ? null : (
              <ActionButton
                action={adminCancelSubscriptionAction}
                fields={{ subscriptionId: subscription.id, refund: "true" }}
                variant="destructive"
                confirmMessage={`Cancelar a assinatura de ${subscription.user.name} e estornar o último pagamento?`}
              >
                Cancelar e estornar o último pagamento
              </ActionButton>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
