/**
 * page.tsx — Um pedido no painel: /admin/vendas/pedidos/[id]  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (botão "Abrir" na lista de pedidos).
 * Mostra: aluno, produto comprado (com a "foto" de preço, dias e cursos), as cobranças (com nota
 * fiscal) e as ações de suporte: reembolsar (a qualquer momento) e conferir no provedor.
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
import { adminRefundOrderAction } from "@/modules/payments/admin/actions";
import { PaymentsTable } from "@/modules/payments/admin/components/payments-table";
import { getOrderForAdmin } from "@/modules/payments/admin/sales-admin.server";
import { OrderStatusBadge } from "@/modules/payments/components/status-badge";
import { PAYMENT_METHOD_LABELS, accessDaysLabel } from "@/modules/payments/labels";
import { formatBRL } from "@/modules/payments/money";

export const metadata: Metadata = {
  title: "Pedido · Painel admin",
  robots: { index: false },
};

export default async function AdminOrderPage({ params }: PageProps<"/admin/vendas/pedidos/[orderId]">) {
  const { orderId } = await params;
  await requireRole("ADMIN", `/admin/vendas/pedidos/${orderId}`);
  const order = await getOrderForAdmin(orderId);
  if (!order) notFound();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <Link href="/admin/vendas/pedidos" className="text-muted-foreground text-sm hover:underline">
          ← Pedidos
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{order.productTitle}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-muted-foreground text-sm">
          Pedido <code>{order.id}</code> · criado em {formatDateTime(order.createdAt)}
          {order.provider === "FAKE" ? " · SIMULADO" : ""}
        </p>
      </div>

      {order.payments.some((payment) => payment.manualRefundRequestedAt) ? (
        <Alert>
          <AlertTitle>Estorno de boleto pendente</AlertTitle>
          <AlertDescription>
            O acesso já foi retirado. Faça o estorno no painel do Asaas (ele pede os dados bancários do aluno). Quando o Asaas
            confirmar, o pedido fica &quot;Reembolsado&quot; sozinho.
          </AlertDescription>
        </Alert>
      ) : null}
      {order.failureReason ? (
        <Alert>
          <AlertTitle>A cobrança não pôde ser criada</AlertTitle>
          <AlertDescription>{order.failureReason}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aluno</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <p>{order.user.name}</p>
            <p className="text-muted-foreground">{order.user.email}</p>
            <Link href={`/admin/usuarios/${order.user.id}`} className="underline">
              Ver usuário e matrículas
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{formatBRL(order.priceCents)}</CardTitle>
            <CardDescription>
              {PAYMENT_METHOD_LABELS[order.method]}
              {order.installments > 1 ? ` em ${order.installments}x` : ""} · acesso {accessDaysLabel(order.accessDays)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <p>Cursos: {order.courses.map((item) => item.course.title).join(", ")}</p>
            {order.paidAt ? <p>Pago em {formatDateTime(order.paidAt)}</p> : null}
            {order.refundRequestedAt ? (
              <p>
                Reembolso pedido em {formatDateTime(order.refundRequestedAt)} (
                {order.refundRequestedBy === "ADMIN" ? "pelo admin" : "pelo aluno"})
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* `min-w-0`: sem isto, a tabela larga "estica" o card (item do grid) e a página rola para o lado no celular. */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Cobranças</CardTitle>
          <CardDescription>Situação de cada cobrança no provedor (numa compra parcelada, uma por parcela).</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentsTable payments={order.payments} />
        </CardContent>
      </Card>

      {order.status === "PAID" ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Reembolsar</CardTitle>
            <CardDescription>
              Pede o estorno ao provedor e retira o acesso desta compra na hora (outras compras e matrículas do aluno não mudam).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionButton
              action={adminRefundOrderAction}
              fields={{ orderId: order.id }}
              variant="destructive"
              confirmMessage={`Reembolsar "${order.productTitle}" de ${order.user.name}? O acesso desta compra termina agora.`}
            >
              Reembolsar pedido
            </ActionButton>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
