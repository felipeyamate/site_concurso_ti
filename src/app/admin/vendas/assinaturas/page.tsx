/**
 * page.tsx — Assinaturas: /admin/vendas/assinaturas  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (submenu Vendas → Assinaturas).
 * Lista as assinaturas, da mais nova para a mais antiga, com filtro por situação e busca por aluno.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Pager, firstParam, pageParam } from "@/components/admin/pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { SubscriptionStatus } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/modules/auth/session";
import { listSubscriptionsForAdmin } from "@/modules/payments/admin/sales-admin.server";
import { SubscriptionStatusBadge } from "@/modules/payments/components/status-badge";
import { PAYMENT_METHOD_LABELS, PLAN_CYCLE_PERIOD, SUBSCRIPTION_STATUS_LABELS } from "@/modules/payments/labels";
import { formatBRL } from "@/modules/payments/money";

export const metadata: Metadata = {
  title: "Assinaturas · Painel admin",
  robots: { index: false },
};

const STATUSES = Object.keys(SUBSCRIPTION_STATUS_LABELS) as SubscriptionStatus[];

export default async function AdminSubscriptionsPage({ searchParams }: PageProps<"/admin/vendas/assinaturas">) {
  await requireRole("ADMIN", "/admin/vendas/assinaturas");
  const params = await searchParams;
  const search = firstParam(params.busca).slice(0, 100);
  const statusParam = firstParam(params.situacao);
  const status = STATUSES.includes(statusParam as SubscriptionStatus) ? (statusParam as SubscriptionStatus) : null;
  const { subscriptions, total, page, pageCount } = await listSubscriptionsForAdmin({
    status,
    search,
    page: pageParam(params.pagina),
  });

  const hrefFor = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("busca", search);
    if (status) query.set("situacao", status);
    query.set("pagina", String(target));
    return `/admin/vendas/assinaturas?${query.toString()}`;
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assinaturas</h1>
        <p className="text-muted-foreground text-sm">{total} assinatura(s).</p>
      </div>

      <form action="/admin/vendas/assinaturas" className="flex flex-wrap gap-2" role="search">
        <Input
          name="busca"
          defaultValue={search}
          placeholder="Aluno (nome ou e-mail)"
          aria-label="Buscar por aluno"
          className="min-w-0 flex-1 sm:max-w-xs"
        />
        <NativeSelect name="situacao" defaultValue={status ?? ""} aria-label="Situação" className="w-auto">
          <option value="">Todas as situações</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {SUBSCRIPTION_STATUS_LABELS[item]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      {/* `relative`: o texto "sr-only" do cabeçalho fica preso aqui dentro, sem alargar a página. */}
      <div className="relative overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="p-3 font-medium">Aluno</th>
              <th className="p-3 font-medium">Plano</th>
              <th className="p-3 font-medium">Situação</th>
              <th className="p-3 font-medium">Desde</th>
              <th className="p-3 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {subscriptions.map((subscription) => (
              <tr key={subscription.id}>
                <td className="p-3">
                  <span className="block">{subscription.user.name}</span>
                  <span className="text-muted-foreground text-xs">{subscription.user.email}</span>
                </td>
                <td className="p-3">
                  {subscription.planTitle}
                  <span className="text-muted-foreground block text-xs">
                    {formatBRL(subscription.priceCents)} {PLAN_CYCLE_PERIOD[subscription.cycle]} ·{" "}
                    {PAYMENT_METHOD_LABELS[subscription.method]}
                    {subscription.provider === "FAKE" ? " · simulado" : ""}
                  </span>
                </td>
                <td className="p-3">
                  <SubscriptionStatusBadge status={subscription.status} />
                </td>
                <td className="p-3 whitespace-nowrap">{formatDateTime(subscription.createdAt)}</td>
                <td className="p-3 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/vendas/assinaturas/${subscription.id}`}>Abrir</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground p-3">
                  Nenhuma assinatura encontrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pager page={page} pageCount={pageCount} hrefFor={hrefFor} />
    </div>
  );
}
