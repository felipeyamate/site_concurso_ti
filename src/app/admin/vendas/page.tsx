/**
 * page.tsx — Vendas no painel: /admin/vendas  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (menu "Vendas" do painel).
 * Mostra: a situação da integração de pagamentos (sem mostrar chaves), os números dos últimos
 * 30 dias e o que precisa de atenção (avisos com erro, estornos de boleto, notas com problema).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { requireRole } from "@/modules/auth/session";
import { getSalesOverview } from "@/modules/payments/admin/sales-admin.server";
import { getFiscalConfig } from "@/modules/payments/fiscal.server";
import { formatBRL } from "@/modules/payments/money";
import { getPaymentsSetup } from "@/modules/payments/provider/provider.server";

export const metadata: Metadata = {
  title: "Vendas · Painel admin",
  robots: { index: false },
};

function SetupRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-b-0">
      <span>{label}</span>
      <span className={ok ? "font-medium" : "text-destructive font-medium"}>{value}</span>
    </div>
  );
}

export default async function SalesOverviewPage() {
  await requireRole("ADMIN", "/admin/vendas");
  const overview = await getSalesOverview();
  const setup = getPaymentsSetup();
  const fiscal = getFiscalConfig();

  const providerLabel = !setup.enabled
    ? "Desligado"
    : setup.kind === "FAKE"
      ? "Simulado (desenvolvimento)"
      : `Asaas — ${setup.environment === "production" ? "produção" : "sandbox (testes)"}`;

  const attention = [
    overview.webhookErrors > 0 && { href: "/admin/vendas/avisos?erros=1", text: `${overview.webhookErrors} aviso(s) do provedor com erro` },
    overview.manualRefunds > 0 && {
      href: "/admin/vendas/pedidos?situacao=REFUND_REQUESTED",
      text: `${overview.manualRefunds} reembolso(s) de boleto para fazer no painel do Asaas`,
    },
    overview.invoiceProblems > 0 && { href: "/admin/vendas/pedidos", text: `${overview.invoiceProblems} nota(s) fiscal(is) com problema` },
  ].filter((item): item is { href: string; text: string } => Boolean(item));

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Vendas</h1>

      {!setup.enabled ? (
        <Alert>
          <AlertTitle>Vendas desligadas</AlertTitle>
          <AlertDescription>{setup.problem}</AlertDescription>
        </Alert>
      ) : null}

      {attention.length > 0 ? (
        <Alert>
          <AlertTitle>Precisa de atenção</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {attention.map((item) => (
                <li key={item.href + item.text}>
                  <Link href={item.href} className="underline">
                    {item.text}
                  </Link>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Pedidos pagos (30 dias)</CardDescription>
            <CardTitle className="text-2xl">{overview.paidOrders}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Recebido (30 dias, bruto)</CardDescription>
            <CardTitle className="text-2xl">{formatBRL(overview.revenueCents)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Assinaturas ativas</CardDescription>
            <CardTitle className="text-2xl">{overview.activeSubscriptions}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integração</CardTitle>
          <CardDescription>Só mostramos SE cada item está configurado — nunca o valor das chaves.</CardDescription>
        </CardHeader>
        <CardContent>
          <SetupRow label="Provedor de pagamento" value={providerLabel} ok={setup.enabled} />
          <SetupRow
            label="Token do webhook (ASAAS_WEBHOOK_TOKEN)"
            value={env.ASAAS_WEBHOOK_TOKEN ? "Configurado" : "Não configurado"}
            ok={Boolean(env.ASAAS_WEBHOOK_TOKEN) || (setup.enabled && setup.kind === "FAKE")}
          />
          <SetupRow label="Nota fiscal automática (NFS-e)" value={fiscal ? "Ligada" : "Desligada"} ok />
          <p className="text-muted-foreground mt-3 text-xs">
            Endereço do webhook para cadastrar no Asaas: <code>{new URL("/api/webhooks/asaas", env.BETTER_AUTH_URL).toString()}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
