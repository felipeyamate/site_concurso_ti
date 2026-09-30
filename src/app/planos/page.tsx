/**
 * page.tsx — Planos de assinatura: /planos  (pública)
 *
 * Quem chama: o Next.js (links "Ver planos" nas páginas dos cursos e na página inicial).
 * Mostra os planos ativos (mensal/anual) e os cursos que a assinatura libera. O botão "Assinar"
 * leva ao checkout (/assinar/[plano]), que pede login.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_CYCLE_LABELS, PLAN_CYCLE_PERIOD } from "@/modules/payments/labels";
import { formatBRL } from "@/modules/payments/money";
import { listPlansPage } from "@/modules/payments/storefront.server";

export const metadata: Metadata = {
  title: "Planos de assinatura",
  description: "Assine e estude todos os cursos incluídos na assinatura enquanto ela estiver ativa.",
};

export default async function PlansPage() {
  // Consulta o banco sem ler cookies: sem isto, o `next build` tentaria montar a página na hora
  // do build (e o CI não tem banco).
  await connection();
  const { plans, courses } = await listPlansPage();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Planos de assinatura</h1>
        <p className="text-muted-foreground max-w-2xl">
          Com a assinatura você assiste a todos os cursos incluídos enquanto ela estiver ativa. Cancele quando quiser: o
          acesso continua até o fim do período já pago.
        </p>
      </div>

      {plans.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm">As assinaturas abrem em breve. Enquanto isso, veja os cursos avulsos.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle>{plan.title}</CardTitle>
                <CardDescription>{PLAN_CYCLE_LABELS[plan.cycle]}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <p className="text-2xl font-semibold">
                  {formatBRL(plan.priceCents)}{" "}
                  <span className="text-muted-foreground text-base font-normal">{PLAN_CYCLE_PERIOD[plan.cycle]}</span>
                </p>
                {plan.description ? <p className="text-sm leading-relaxed">{plan.description}</p> : null}
                <Button asChild className="w-fit">
                  <Link href={`/assinar/${plan.slug}`}>Assinar</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {courses.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Cursos incluídos na assinatura</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {courses.map((course) => (
              <li key={course.id} className="rounded-md border p-3 text-sm">
                <Link href={`/cursos/${course.slug}`} className="font-medium hover:underline">
                  {course.title}
                </Link>
                {course.subtitle ? <p className="text-muted-foreground">{course.subtitle}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
