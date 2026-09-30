/**
 * page.tsx — Assinatura no painel: /admin/vendas/planos  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (submenu Vendas → Planos).
 * Mostra: os planos (mensal/anual), o formulário de novo plano e a lista de CURSOS INCLUÍDOS na
 * assinatura (vale para todos os planos).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/modules/auth/session";
import { NewPlanForm, SubscriptionCoursesForm } from "@/modules/payments/admin/components/plan-forms";
import { listCoursesForSales, listPlansForAdmin } from "@/modules/payments/admin/sales-admin.server";
import { PLAN_CYCLE_PERIOD } from "@/modules/payments/labels";
import { formatBRL } from "@/modules/payments/money";

export const metadata: Metadata = {
  title: "Planos · Painel admin",
  robots: { index: false },
};

export default async function AdminPlansPage() {
  await requireRole("ADMIN", "/admin/vendas/planos");
  const [plans, courses] = await Promise.all([listPlansForAdmin(), listCoursesForSales()]);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Assinatura</h1>
        <p className="text-muted-foreground text-sm">
          Quem assina assiste a todos os cursos incluídos enquanto o ciclo estiver pago. Página pública:{" "}
          <Link href="/planos" className="underline" target="_blank">
            /planos
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cursos incluídos na assinatura</CardTitle>
          <CardDescription>Valem para todos os planos.</CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriptionCoursesForm courses={courses} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Novo plano</CardTitle>
          <CardDescription>Nasce inativo: revise e ative.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewPlanForm />
        </CardContent>
      </Card>

      {plans.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum plano ainda.</p>
      ) : (
        <div className="grid gap-3">
          {plans.map((plan) => (
            <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{plan.title}</span>
                  <Badge variant={plan.isActive ? "default" : "secondary"}>{plan.isActive ? "Ativo" : "Inativo"}</Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {formatBRL(plan.priceCents)} {PLAN_CYCLE_PERIOD[plan.cycle]} · {plan._count.subscriptions} assinatura(s)
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/vendas/planos/${plan.id}`}>Editar</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
