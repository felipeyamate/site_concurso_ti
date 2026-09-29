/**
 * page.tsx — Um usuário no painel: /admin/usuarios/[id]  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (botão "Gerenciar" na lista de usuários).
 * Mostra: dados da conta, o perfil (com as travas de segurança), as matrículas — com o
 * formulário para matricular/renovar e o botão para revogar o acesso manual — e as compras
 * (pedidos e assinaturas, com link para o painel de vendas).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/admin/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { getUserForAdmin, listCoursesForEnrollment } from "@/modules/auth/admin-users.server";
import { RoleForm } from "@/modules/auth/components/role-form";
import { requireRole } from "@/modules/auth/session";
import { getEnrollmentStatus, type EnrollmentStatus } from "@/modules/enrollment/access";
import { revokeEnrollmentAction } from "@/modules/enrollment/admin-actions";
import { GrantEnrollmentForm } from "@/modules/enrollment/components/grant-enrollment-form";
import { OrderStatusBadge, SubscriptionStatusBadge } from "@/modules/payments/components/status-badge";
import { PLAN_CYCLE_PERIOD } from "@/modules/payments/labels";
import { formatBRL } from "@/modules/payments/money";

export const metadata: Metadata = {
  title: "Usuário · Painel admin",
  robots: { index: false },
};

const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  NONE: "Sem matrícula",
  ACTIVE: "Ativa",
  NOT_STARTED: "Ainda não começou",
  EXPIRED: "Vencida",
  REVOKED: "Revogada",
};

const SOURCE_LABELS = { MANUAL: "Manual", PURCHASE: "Compra", SUBSCRIPTION: "Assinatura" } as const;

export default async function AdminUserPage({ params }: PageProps<"/admin/usuarios/[userId]">) {
  const { userId } = await params;
  const { user: admin } = await requireRole("ADMIN", `/admin/usuarios/${userId}`);
  const [user, courses] = await Promise.all([getUserForAdmin(userId), listCoursesForEnrollment()]);
  if (!user) notFound();

  const now = new Date();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <Link href="/admin/usuarios" className="text-muted-foreground text-sm hover:underline">
          ← Usuários
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
        <p className="text-muted-foreground text-sm">
          {user.email} · {user.emailVerified ? "e-mail confirmado" : "e-mail não confirmado"} · cadastro em{" "}
          {formatDateTime(user.createdAt)} · {user._count.sessions} dispositivo(s) conectado(s)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleForm userId={user.id} role={user.role} isSelf={user.id === admin.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Matrículas</CardTitle>
          <CardDescription>
            Quem libera as aulas é a matrícula (uma por origem: manual, compra ou assinatura — basta uma ativa).
            Aqui você cuida das manuais; revogar não apaga nada. Acesso comprado sai pelo reembolso do pedido.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {user.enrollments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma matrícula.</p>
          ) : (
            <div className="relative overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground border-b">
                  <tr>
                    <th className="p-3 font-medium">Curso</th>
                    <th className="p-3 font-medium">Situação</th>
                    <th className="p-3 font-medium">Origem</th>
                    <th className="p-3 font-medium">Início</th>
                    <th className="p-3 font-medium">Fim</th>
                    <th className="p-3 font-medium">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {user.enrollments.map((enrollment) => {
                    const status = getEnrollmentStatus(enrollment, now);
                    return (
                      <tr key={enrollment.id}>
                        <td className="p-3">{enrollment.course.title}</td>
                        <td className="p-3">
                          <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>{STATUS_LABELS[status]}</Badge>
                        </td>
                        <td className="p-3">{SOURCE_LABELS[enrollment.source]}</td>
                        <td className="p-3 whitespace-nowrap">{formatDate(enrollment.startsAt)}</td>
                        <td className="p-3 whitespace-nowrap">
                          {enrollment.revokedAt
                            ? `revogada em ${formatDate(enrollment.revokedAt)}`
                            : enrollment.expiresAt
                              ? formatDate(enrollment.expiresAt)
                              : "sem data de fim"}
                        </td>
                        <td className="p-3 text-right">
                          {/* Só a matrícula manual é revogada aqui; o acesso pago sai pelo reembolso. */}
                          {enrollment.source === "MANUAL" && !enrollment.revokedAt ? (
                            <ActionButton
                              action={revokeEnrollmentAction}
                              fields={{ userId: user.id, courseId: enrollment.courseId }}
                              variant="outline"
                              size="sm"
                              confirmMessage={`Revogar o acesso de ${user.name} a "${enrollment.course.title}"?`}
                            >
                              Revogar
                            </ActionButton>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid gap-2">
            <h2 className="text-sm font-semibold">Matricular / renovar</h2>
            <GrantEnrollmentForm userId={user.id} courses={courses} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compras</CardTitle>
          <CardDescription>Pedidos e assinaturas. Reembolso e detalhes no painel de vendas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {user.orders.length === 0 && user.subscriptions.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma compra.</p>
          ) : null}
          {user.subscriptions.map((subscription) => (
            <div key={subscription.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
              <Link href={`/admin/vendas/assinaturas/${subscription.id}`} className="underline">
                Assinatura: {subscription.planTitle} ({formatBRL(subscription.priceCents)} {PLAN_CYCLE_PERIOD[subscription.cycle]})
              </Link>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">{formatDate(subscription.createdAt)}</span>
                <SubscriptionStatusBadge status={subscription.status} />
              </span>
            </div>
          ))}
          {user.orders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
              <Link href={`/admin/vendas/pedidos/${order.id}`} className="underline">
                {order.productTitle} ({formatBRL(order.priceCents)})
              </Link>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">{formatDate(order.createdAt)}</span>
                <OrderStatusBadge status={order.status} />
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
