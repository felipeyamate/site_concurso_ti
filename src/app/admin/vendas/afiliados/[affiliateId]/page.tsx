/**
 * page.tsx — Um afiliado: /admin/vendas/afiliados/[id]  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (lista de afiliados → Abrir; ou o link no pedido/assinatura).
 * Mostra: cadastro (comissão, como pagar, ativo), o link de divulgação, as somas, as comissões
 * (uma por cobrança paga), o botão de registrar pagamento e os pagamentos já feitos.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { getAffiliateForAdmin } from "@/modules/affiliates/affiliates.server";
import { AffiliateSettingsForm, PayoutForm } from "@/modules/affiliates/components/affiliate-forms";
import { CommissionsTable } from "@/modules/affiliates/components/commissions-table";
import { ReferralLinkBuilder } from "@/modules/affiliates/components/referral-link-builder";
import { requireRole } from "@/modules/auth/session";
import { formatBRL } from "@/modules/payments/money";
import { siteUrl } from "@/modules/seo/site.server";

export const metadata: Metadata = {
  title: "Afiliado · Painel admin",
  robots: { index: false },
};

export default async function AdminAffiliatePage({ params }: PageProps<"/admin/vendas/afiliados/[affiliateId]">) {
  const { affiliateId } = await params;
  await requireRole("ADMIN", `/admin/vendas/afiliados/${affiliateId}`);
  const report = await getAffiliateForAdmin(affiliateId);
  if (!report) notFound();
  const { affiliate, totals } = report;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <Link href="/admin/vendas/afiliados" className="text-muted-foreground text-sm hover:underline">
          ← Afiliados
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{affiliate.user.name}</h1>
        <p className="text-muted-foreground text-sm">
          {affiliate.user.email} · código <span className="font-mono">{affiliate.code}</span> · {report.clicks30Days} clique(s) nos últimos 30
          dias · {report.sales} venda(s) ·{" "}
          <Link href={`/admin/usuarios/${affiliate.user.id}`} className="underline">
            ver usuário
          </Link>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {(
          [
            ["Liberado para pagar", totals.AVAILABLE],
            ["Em carência (7 dias)", totals.HOLD],
            ["Já pago", totals.PAID_OUT],
            ["Cancelado (estornos)", totals.CANCELED],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">{formatBRL(value)}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrar pagamento</CardTitle>
          <CardDescription>
            Pague {formatBRL(totals.AVAILABLE)} fora do site ({affiliate.payoutInfo || "sem dados de recebimento — peça ao afiliado"}) e registre aqui:
            as comissões liberadas passam para &quot;Paga&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PayoutForm affiliateId={affiliate.id} availableLabel={formatBRL(totals.AVAILABLE)} disabled={totals.AVAILABLE <= 0} />
        </CardContent>
      </Card>

      {/* `min-w-0`: a tabela larga não estica o card nem a página no celular. */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Comissões</CardTitle>
          <CardDescription>Uma por cobrança paga (na assinatura, cada ciclo pago).</CardDescription>
        </CardHeader>
        <CardContent>
          <CommissionsTable rows={report.commissions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagamentos feitos</CardTitle>
        </CardHeader>
        <CardContent>
          {report.payouts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum pagamento registrado.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {report.payouts.map((payout) => (
                <li key={payout.id}>
                  {formatDateTime(payout.createdAt)} · <strong>{formatBRL(payout.amountCents)}</strong> · {payout._count.items} comissão(ões)
                  {payout.note ? ` · ${payout.note}` : ""}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cadastro</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <AffiliateSettingsForm
            affiliate={{
              id: affiliate.id,
              commissionPercent: String(affiliate.commissionBps / 100).replace(".", ","),
              payoutInfo: affiliate.payoutInfo,
              isActive: affiliate.isActive,
            }}
          />
          <ReferralLinkBuilder siteUrl={siteUrl()} code={affiliate.code} />
        </CardContent>
      </Card>
    </div>
  );
}
