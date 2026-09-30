/**
 * my-purchases.tsx — "Minhas compras": pedidos e assinaturas do aluno, com o que dá para fazer.
 *
 * Quem chama: /area-do-aluno/compras.
 * Para cada pedido: situação, "Pagar" (se aguardando), "Pedir reembolso" (até 7 dias depois do
 * pagamento) e a nota fiscal (quando emitida). Para cada assinatura: situação, até quando vale,
 * "Pagar" a cobrança em aberto e "Cancelar" (com reembolso, se ainda no prazo do 1º pagamento).
 */
import Link from "next/link";

import { ActionButton } from "@/components/admin/action-button";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

import { cancelSubscriptionAction, requestRefundAction } from "../actions";
import { PAYMENT_METHOD_LABELS, PLAN_CYCLE_PERIOD } from "../labels";
import { formatBRL } from "../money";
import type { listMyPurchases } from "../storefront.server";
import { OrderStatusBadge, SubscriptionStatusBadge } from "./status-badge";

type Purchases = Awaited<ReturnType<typeof listMyPurchases>>;
type Invoice = { status: string; pdfUrl: string | null; number: string | null };

function InvoiceLinks({ invoices }: { invoices: Invoice[] }) {
  const ready = invoices.filter((invoice) => invoice.status === "AUTHORIZED" && invoice.pdfUrl);
  if (ready.length === 0) return null;
  return (
    <p className="text-sm">
      Nota fiscal:{" "}
      {ready.map((invoice, index) => (
        <a key={invoice.pdfUrl ?? index} href={invoice.pdfUrl ?? "#"} target="_blank" rel="noreferrer" className="underline">
          {invoice.number ? `nº ${invoice.number}` : `PDF ${index + 1}`}
        </a>
      ))}
    </p>
  );
}

export function MyPurchases({ orders, subscriptions }: Purchases) {
  if (orders.length === 0 && subscriptions.length === 0) {
    return (
      <div className="grid gap-3 rounded-lg border p-6 text-sm">
        <p>Você ainda não fez nenhuma compra.</p>
        <Button asChild className="w-fit">
          <Link href="/cursos">Ver cursos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      {subscriptions.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Assinaturas</h2>
          {subscriptions.map((subscription) => (
            <article key={subscription.id} className="grid gap-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{subscription.planTitle}</h3>
                <SubscriptionStatusBadge status={subscription.status} />
              </div>
              <p className="text-muted-foreground text-sm">
                {formatBRL(subscription.priceCents)} {PLAN_CYCLE_PERIOD[subscription.cycle]}
                {subscription.couponCode ? ` (cupom ${subscription.couponCode}: −${formatBRL(subscription.discountCents)})` : ""} ·{" "}
                {PAYMENT_METHOD_LABELS[subscription.method]} · desde {formatDate(subscription.createdAt)}
              </p>
              {subscription.paidUntil ? (
                <p className="text-sm">
                  Acesso garantido até <strong>{formatDate(subscription.paidUntil)}</strong>
                  {subscription.status === "CANCELED" ? " (assinatura cancelada: não haverá novas cobranças)." : "."}
                </p>
              ) : null}
              <InvoiceLinks invoices={subscription.invoices} />
              <div className="flex flex-wrap items-start gap-2">
                {subscription.openPaymentId ? (
                  <Button asChild size="sm">
                    <Link href={`/area-do-aluno/pagamentos/${subscription.openPaymentId}`}>Pagar</Link>
                  </Button>
                ) : null}
                {subscription.status !== "CANCELED" ? (
                  subscription.canRequestRefund ? (
                    <ActionButton
                      action={cancelSubscriptionAction}
                      fields={{ subscriptionId: subscription.id, refund: "true" }}
                      variant="outline"
                      size="sm"
                      confirmMessage="Cancelar a assinatura e pedir o reembolso do 1º pagamento? O acesso termina agora."
                    >
                      Cancelar e pedir reembolso
                    </ActionButton>
                  ) : (
                    <ActionButton
                      action={cancelSubscriptionAction}
                      fields={{ subscriptionId: subscription.id }}
                      variant="outline"
                      size="sm"
                      confirmMessage="Cancelar a assinatura? Você continua com acesso até o fim do período já pago."
                    >
                      Cancelar assinatura
                    </ActionButton>
                  )
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {orders.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Pedidos</h2>
          {orders.map((order) => (
            <article key={order.id} className="grid gap-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{order.productTitle}</h3>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="text-muted-foreground text-sm">
                {formatBRL(order.priceCents)}
                {order.couponCode ? ` (cupom ${order.couponCode}: −${formatBRL(order.discountCents)})` : ""} ·{" "}
                {PAYMENT_METHOD_LABELS[order.method]}
                {order.installments > 1 ? ` em ${order.installments}x` : ""} · pedido em {formatDate(order.createdAt)}
                {order.paidAt ? ` · pago em ${formatDate(order.paidAt)}` : ""}
              </p>
              <InvoiceLinks invoices={order.invoices} />
              <div className="flex flex-wrap items-start gap-2">
                {(order.status === "PENDING" || order.status === "OVERDUE") && order.payPaymentId ? (
                  <Button asChild size="sm">
                    <Link href={`/area-do-aluno/pagamentos/${order.payPaymentId}`}>Pagar</Link>
                  </Button>
                ) : null}
                {order.canRequestRefund ? (
                  <ActionButton
                    action={requestRefundAction}
                    fields={{ orderId: order.id }}
                    variant="outline"
                    size="sm"
                    confirmMessage={`Pedir o reembolso de "${order.productTitle}"? O acesso aos cursos desta compra termina agora.`}
                  >
                    Pedir reembolso
                  </ActionButton>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
