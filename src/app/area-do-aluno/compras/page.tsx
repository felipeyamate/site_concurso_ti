/**
 * page.tsx — Minhas compras: /area-do-aluno/compras  (exige login)
 *
 * Quem chama: o Next.js (link na área do aluno; o Asaas também manda o aluno para cá depois de
 * pagar com cartão).
 * Mostra pedidos e assinaturas, com "Pagar", "Pedir reembolso" (7 dias), "Cancelar assinatura"
 * e as notas fiscais.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { requireSession } from "@/modules/auth/session";
import { MyPurchases } from "@/modules/payments/components/my-purchases";
import { REFUND_WINDOW_DAYS } from "@/modules/payments/rules";
import { listMyPurchases } from "@/modules/payments/storefront.server";

export const metadata: Metadata = {
  title: "Minhas compras",
  robots: { index: false },
};

export default async function MyPurchasesPage() {
  const { user } = await requireSession("/area-do-aluno/compras");
  const purchases = await listMyPurchases(user.id);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <Link href="/area-do-aluno" className="text-muted-foreground text-sm hover:underline">
          ← Área do aluno
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Minhas compras</h1>
        <p className="text-muted-foreground text-sm">
          O acesso é liberado assim que o pagamento é confirmado. Você pode pedir reembolso em até {REFUND_WINDOW_DAYS}{" "}
          dias depois do pagamento.
        </p>
      </div>
      <MyPurchases {...purchases} />
    </div>
  );
}
