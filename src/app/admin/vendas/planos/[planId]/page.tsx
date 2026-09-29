/**
 * page.tsx — Editar um plano de assinatura: /admin/vendas/planos/[id]  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (botão "Editar" em Planos, ou logo depois de criar).
 * Mudar preço/ciclo vale só para NOVAS assinaturas (as antigas guardam o preço da época).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/admin/action-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/modules/auth/session";
import { deletePlanAction } from "@/modules/payments/admin/actions";
import { PlanForm } from "@/modules/payments/admin/components/plan-forms";
import { getPlanForAdmin } from "@/modules/payments/admin/sales-admin.server";
import { formatCentsForInput } from "@/modules/payments/money";

export const metadata: Metadata = {
  title: "Editar plano · Painel admin",
  robots: { index: false },
};

export default async function AdminPlanPage({ params }: PageProps<"/admin/vendas/planos/[planId]">) {
  const { planId } = await params;
  await requireRole("ADMIN", `/admin/vendas/planos/${planId}`);
  const plan = await getPlanForAdmin(planId);
  if (!plan) notFound();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <Link href="/admin/vendas/planos" className="text-muted-foreground text-sm hover:underline">
          ← Planos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{plan.title}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do plano</CardTitle>
          <CardDescription>Preço e ciclo novos valem só para novas assinaturas.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlanForm
            plan={{
              id: plan.id,
              title: plan.title,
              slug: plan.slug,
              description: plan.description,
              price: formatCentsForInput(plan.priceCents),
              cycle: plan.cycle,
              isActive: plan.isActive,
            }}
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Apagar plano</CardTitle>
          <CardDescription>
            {plan._count.subscriptions > 0
              ? `Este plano tem ${plan._count.subscriptions} assinatura(s): não pode ser apagado. Para parar de vender, desmarque "Ativo".`
              : "Nunca vendeu: pode ser apagado."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionButton
            action={deletePlanAction}
            fields={{ id: plan.id }}
            variant="destructive"
            disabled={plan._count.subscriptions > 0}
            confirmMessage={`Apagar o plano "${plan.title}"?`}
          >
            Apagar plano
          </ActionButton>
        </CardContent>
      </Card>
    </div>
  );
}
