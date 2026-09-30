/**
 * page.tsx — Afiliados: /admin/vendas/afiliados  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (submenu Vendas → Afiliados).
 * Lista os afiliados com o que está liberado para pagar e cadastra um novo (a pessoa precisa ter
 * conta no site).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAffiliatesForAdmin } from "@/modules/affiliates/affiliates-admin.server";
import { NewAffiliateForm } from "@/modules/affiliates/components/affiliate-forms";
import { formatCommissionRate } from "@/modules/affiliates/rules";
import { requireRole } from "@/modules/auth/session";
import { formatBRL } from "@/modules/payments/money";

export const metadata: Metadata = {
  title: "Afiliados · Painel admin",
  robots: { index: false },
};

export default async function AdminAffiliatesPage() {
  await requireRole("ADMIN", "/admin/vendas/afiliados");
  const affiliates = await listAffiliatesForAdmin();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Afiliados</h1>
        <p className="text-muted-foreground text-sm">
          Quem divulga pelo link (/r/código) ou por um cupom próprio ganha comissão sobre cada pagamento das vendas indicadas. A comissão
          fica em carência por 7 dias (prazo de arrependimento) e depois é liberada para você pagar (fora do site) e registrar aqui.
        </p>
      </div>

      {affiliates.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum afiliado ainda.</p>
      ) : (
        <div className="grid gap-3">
          {affiliates.map((affiliate) => (
            <div key={affiliate.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{affiliate.user.name}</span>
                  <span className="text-muted-foreground font-mono text-sm">{affiliate.code}</span>
                  <Badge variant={affiliate.isActive ? "default" : "secondary"}>{affiliate.isActive ? "Ativo" : "Inativo"}</Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {formatCommissionRate(affiliate.commissionBps)} · liberado para pagar: <strong>{formatBRL(affiliate.totals.AVAILABLE)}</strong> · em
                  carência: {formatBRL(affiliate.totals.HOLD)} · já pago: {formatBRL(affiliate.totals.PAID_OUT)}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/vendas/afiliados/${affiliate.id}`}>Abrir</Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Novo afiliado</CardTitle>
          <CardDescription>A pessoa precisa ter uma conta no site (ela acompanha as comissões na área do aluno).</CardDescription>
        </CardHeader>
        <CardContent>
          <NewAffiliateForm />
        </CardContent>
      </Card>
    </div>
  );
}
