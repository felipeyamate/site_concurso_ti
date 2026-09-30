/**
 * page.tsx — Pedidos (compras avulsas): /admin/vendas/pedidos  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (submenu Vendas → Pedidos).
 * Lista os pedidos, do mais novo para o mais antigo, com filtro por situação e busca por aluno.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Pager, firstParam, pageParam } from "@/components/admin/pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { OrderStatus } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/modules/auth/session";
import { listOrdersForAdmin } from "@/modules/payments/admin/sales-admin.server";
import { OrderStatusBadge } from "@/modules/payments/components/status-badge";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/modules/payments/labels";
import { formatBRL } from "@/modules/payments/money";

export const metadata: Metadata = {
  title: "Pedidos · Painel admin",
  robots: { index: false },
};

const STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/vendas/pedidos">) {
  await requireRole("ADMIN", "/admin/vendas/pedidos");
  const params = await searchParams;
  const search = firstParam(params.busca).slice(0, 100);
  const statusParam = firstParam(params.situacao);
  const status = STATUSES.includes(statusParam as OrderStatus) ? (statusParam as OrderStatus) : null;
  const { orders, total, page, pageCount } = await listOrdersForAdmin({ status, search, page: pageParam(params.pagina) });

  const hrefFor = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("busca", search);
    if (status) query.set("situacao", status);
    query.set("pagina", String(target));
    return `/admin/vendas/pedidos?${query.toString()}`;
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-muted-foreground text-sm">{total} pedido(s).</p>
      </div>

      <form action="/admin/vendas/pedidos" className="flex flex-wrap gap-2" role="search">
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
              {ORDER_STATUS_LABELS[item]}
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
              <th className="p-3 font-medium">Produto</th>
              <th className="p-3 font-medium">Valor</th>
              <th className="p-3 font-medium">Situação</th>
              <th className="p-3 font-medium">Criado</th>
              <th className="p-3 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="p-3">
                  <span className="block">{order.user.name}</span>
                  <span className="text-muted-foreground text-xs">{order.user.email}</span>
                </td>
                <td className="p-3">
                  {order.productTitle}
                  {order.provider === "FAKE" ? <span className="text-muted-foreground text-xs"> (simulado)</span> : null}
                </td>
                <td className="p-3 whitespace-nowrap">
                  {formatBRL(order.priceCents)}
                  <span className="text-muted-foreground block text-xs">
                    {PAYMENT_METHOD_LABELS[order.method]}
                    {order.installments > 1 ? ` ${order.installments}x` : ""}
                  </span>
                </td>
                <td className="p-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="p-3 whitespace-nowrap">{formatDateTime(order.createdAt)}</td>
                <td className="p-3 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/vendas/pedidos/${order.id}`}>Abrir</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted-foreground p-3">
                  Nenhum pedido encontrado.
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
