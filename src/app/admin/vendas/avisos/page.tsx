/**
 * page.tsx — Avisos do provedor (webhooks): /admin/vendas/avisos  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (submenu Vendas → Avisos do provedor).
 * Lista os avisos recebidos (mais novos primeiro): tipo, quando chegou, o que foi feito (ou o erro)
 * e o botão "Reprocessar" — para um aviso que deu erro (ex.: depois de corrigir um problema).
 * Reprocessar é seguro: o acesso é RECALCULADO a partir dos pagamentos, nunca "somado" de novo.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { ActionButton } from "@/components/admin/action-button";
import { Pager, firstParam, pageParam } from "@/components/admin/pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/modules/auth/session";
import { reprocessWebhookAction } from "@/modules/payments/admin/actions";
import { listWebhookEvents } from "@/modules/payments/admin/sales-admin.server";

export const metadata: Metadata = {
  title: "Avisos do provedor · Painel admin",
  robots: { index: false },
};

export default async function AdminWebhookEventsPage({ searchParams }: PageProps<"/admin/vendas/avisos">) {
  await requireRole("ADMIN", "/admin/vendas/avisos");
  const params = await searchParams;
  const onlyErrors = firstParam(params.erros) === "1";
  const { events, total, page, pageCount } = await listWebhookEvents({ onlyErrors, page: pageParam(params.pagina) });

  const hrefFor = (target: number) => `/admin/vendas/avisos?${onlyErrors ? "erros=1&" : ""}pagina=${target}`;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Avisos do provedor</h1>
        <p className="text-muted-foreground text-sm">
          Tudo que o provedor de pagamento avisou (pago, estornado, nota emitida...). {total} aviso(s)
          {onlyErrors ? " com erro" : ""}.
        </p>
        <div className="flex gap-2">
          <Button asChild variant={onlyErrors ? "outline" : "default"} size="sm">
            <Link href="/admin/vendas/avisos">Todos</Link>
          </Button>
          <Button asChild variant={onlyErrors ? "default" : "outline"} size="sm">
            <Link href="/admin/vendas/avisos?erros=1">Só com erro</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        {events.map((event) => (
          <div key={event.id} className="grid gap-1 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <code className="text-xs">{event.type}</code>
                {event.error ? (
                  <Badge variant="destructive">Erro</Badge>
                ) : event.processedAt ? (
                  <Badge variant="secondary">Processado</Badge>
                ) : (
                  <Badge variant="outline">Pendente</Badge>
                )}
                {event.provider === "FAKE" ? <span className="text-muted-foreground text-xs">simulado</span> : null}
              </span>
              <span className="text-muted-foreground text-xs">{formatDateTime(event.receivedAt)}</span>
            </div>
            {event.note ? <p>{event.note}</p> : null}
            {event.error ? <p className="text-destructive">{event.error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs break-all">
                {event.eventId} · {event.attempts} tentativa(s)
              </span>
              {event.error || !event.processedAt ? (
                <ActionButton action={reprocessWebhookAction} fields={{ id: event.id }} variant="outline" size="sm">
                  Reprocessar
                </ActionButton>
              ) : null}
            </div>
          </div>
        ))}
        {events.length === 0 ? <p className="text-muted-foreground text-sm">Nenhum aviso.</p> : null}
      </div>

      <Pager page={page} pageCount={pageCount} hrefFor={hrefFor} />
    </div>
  );
}
