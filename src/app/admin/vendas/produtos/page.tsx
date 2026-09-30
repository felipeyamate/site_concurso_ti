/**
 * page.tsx — Produtos à venda: /admin/vendas/produtos  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (submenu Vendas → Produtos).
 * Lista os produtos (curso avulso ou pacote) e cria um novo (nasce INATIVO, sem cursos).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/modules/auth/session";
import { NewProductForm } from "@/modules/payments/admin/components/product-forms";
import { listProductsForAdmin } from "@/modules/payments/admin/sales-admin.server";
import { accessDaysLabel } from "@/modules/payments/labels";
import { formatBRL } from "@/modules/payments/money";

export const metadata: Metadata = {
  title: "Produtos · Painel admin",
  robots: { index: false },
};

export default async function AdminProductsPage() {
  await requireRole("ADMIN", "/admin/vendas/produtos");
  const products = await listProductsForAdmin();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
        <p className="text-muted-foreground text-sm">
          Um produto libera um ou mais cursos por um tempo (ou sem data de fim). Aparece na página dos cursos incluídos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo produto</CardTitle>
          <CardDescription>Nasce inativo: depois escolha os cursos e ative.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewProductForm />
        </CardContent>
      </Card>

      {products.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum produto ainda.</p>
      ) : (
        <div className="grid gap-3">
          {products.map((product) => (
            <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{product.title}</span>
                  <Badge variant={product.isActive ? "default" : "secondary"}>{product.isActive ? "Ativo" : "Inativo"}</Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {formatBRL(product.priceCents)} · acesso {accessDaysLabel(product.accessDays)} · até {product.maxInstallments}x ·{" "}
                  {product.courses.length === 0 ? "sem cursos" : product.courses.map((item) => item.course.title).join(", ")} ·{" "}
                  {product._count.orders} pedido(s)
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/vendas/produtos/${product.id}`}>Editar</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
