/**
 * page.tsx — Área do afiliado: /area-do-aluno/afiliado  (exige login; só para quem é afiliado)
 *
 * Quem chama: o Next.js (cartão "Programa de afiliados" na área do aluno).
 * Mostra: o link de divulgação (para qualquer página do site), cliques e vendas, as comissões
 * (em carência, liberadas, pagas) e "como você quer receber". Quem não é afiliado → 404.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { getAffiliateDashboard } from "@/modules/affiliates/affiliates.server";
import { OwnPayoutInfoForm } from "@/modules/affiliates/components/affiliate-forms";
import { CommissionsTable } from "@/modules/affiliates/components/commissions-table";
import { ReferralLinkBuilder } from "@/modules/affiliates/components/referral-link-builder";
import { AFFILIATE_COOKIE_DAYS, COMMISSION_HOLD_DAYS, formatCommissionRate } from "@/modules/affiliates/rules";
import { requireSession } from "@/modules/auth/session";
import { formatBRL } from "@/modules/payments/money";
import { siteUrl } from "@/modules/seo/site.server";

export const metadata: Metadata = {
  title: "Programa de afiliados",
  robots: { index: false },
};

export default async function AffiliateAreaPage() {
  const { user } = await requireSession("/area-do-aluno/afiliado");
  const report = await getAffiliateDashboard(user.id);
  if (!report) notFound();
  const { affiliate, totals } = report;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <Link href="/area-do-aluno" className="text-muted-foreground text-sm hover:underline">
          ← Área do aluno
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Programa de afiliados</h1>
        <p className="text-muted-foreground text-sm">
          Sua comissão: <strong>{formatCommissionRate(affiliate.commissionBps)}</strong> de cada pagamento das vendas indicadas por você
          (na assinatura, de cada mês/ano pago). Vale o último link clicado nos {AFFILIATE_COOKIE_DAYS} dias antes da compra.
          {affiliate.isActive ? "" : " Seu cadastro está DESATIVADO: vendas novas não geram comissão."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seu link de divulgação</CardTitle>
          <CardDescription>Aponte para qualquer página do site: a indicação vale do mesmo jeito.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReferralLinkBuilder siteUrl={siteUrl()} code={affiliate.code} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        {(
          [
            ["Cliques (30 dias)", String(report.clicks30Days)],
            ["Vendas indicadas", String(report.sales)],
            ["A receber (liberado)", formatBRL(totals.AVAILABLE)],
            ["Já recebido", formatBRL(totals.PAID_OUT)],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* `min-w-0`: a tabela larga não estica o card nem a página no celular. */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Comissões</CardTitle>
          <CardDescription>
            Cada comissão fica {COMMISSION_HOLD_DAYS} dias em carência (o aluno pode pedir reembolso nesse prazo) e depois é liberada para
            pagamento. Em carência agora: {formatBRL(totals.HOLD)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CommissionsTable rows={report.commissions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recebimento</CardTitle>
          <CardDescription>
            Os pagamentos são feitos pela equipe, fora do site.
            {report.payouts.length > 0 ? ` Último: ${formatBRL(report.payouts[0].amountCents)} em ${formatDate(report.payouts[0].createdAt)}.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OwnPayoutInfoForm payoutInfo={affiliate.payoutInfo} />
        </CardContent>
      </Card>
    </div>
  );
}
