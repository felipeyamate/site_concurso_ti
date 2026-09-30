/**
 * course-offers.tsx — "Como ter acesso a este curso": produtos à venda e a assinatura.
 *
 * Quem chama: a página do curso (/cursos/[curso]), para quem ainda não tem acesso.
 * Mostra cada produto ativo que inclui o curso (preço, parcelas, tempo de acesso) e, se o curso
 * faz parte da assinatura, o plano mais em conta. Os botões levam ao checkout (que pede login).
 */
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { PLAN_CYCLE_PERIOD, accessDaysLabel } from "../labels";
import { formatBRL, installmentOptions } from "../money";

type ProductOffer = {
  slug: string;
  title: string;
  priceCents: number;
  accessDays: number | null;
  maxInstallments: number;
  _count: { courses: number };
};
type PlanOffer = { slug: string; title: string; priceCents: number; cycle: "MONTHLY" | "YEARLY" };

export function CourseOffers({ products, plans }: { products: ProductOffer[]; plans: PlanOffer[] }) {
  if (products.length === 0 && plans.length === 0) return null;
  const cheapestPlan = plans[0];

  return (
    <div className="grid gap-3">
      {products.map((product) => {
        const options = installmentOptions(product.priceCents, product.maxInstallments);
        const longest = options.at(-1);
        return (
          <div key={product.slug} className="grid gap-2 rounded-lg border p-4">
            <p className="font-medium">{product.title}</p>
            <p className="text-2xl font-semibold">{formatBRL(product.priceCents)}</p>
            <p className="text-muted-foreground text-sm">
              {longest && longest.count > 1 ? `ou até ${longest.count}x de ${formatBRL(longest.valueCents)} sem juros · ` : ""}
              acesso {product.accessDays === null ? "" : "por "}
              {accessDaysLabel(product.accessDays)}
              {product._count.courses > 1 ? ` · ${product._count.courses} cursos` : ""}
            </p>
            <Button asChild className="w-fit">
              <Link href={`/comprar/${product.slug}`}>Comprar</Link>
            </Button>
          </div>
        );
      })}
      {cheapestPlan ? (
        <div className="grid gap-2 rounded-lg border border-dashed p-4">
          <p className="text-sm">
            Este curso faz parte da <strong>assinatura</strong>: a partir de {formatBRL(cheapestPlan.priceCents)}{" "}
            {PLAN_CYCLE_PERIOD[cheapestPlan.cycle]}, você assiste a todos os cursos incluídos.
          </p>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/planos">Ver planos de assinatura</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
