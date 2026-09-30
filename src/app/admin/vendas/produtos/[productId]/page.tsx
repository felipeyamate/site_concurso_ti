/**
 * page.tsx — Editar um produto: /admin/vendas/produtos/[id]  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (botão "Editar" na lista, ou logo depois de criar).
 * Mostra: dados do produto (preço, dias, parcelas, ativo), os cursos que ele libera e o botão de
 * apagar (só para produto que nunca vendeu).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/admin/action-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/modules/auth/session";
import { deleteProductAction } from "@/modules/payments/admin/actions";
import { ProductForm } from "@/modules/payments/admin/components/product-forms";
import { getProductForAdmin, listCoursesForSales } from "@/modules/payments/admin/sales-admin.server";
import { formatCentsForInput } from "@/modules/payments/money";

export const metadata: Metadata = {
  title: "Editar produto · Painel admin",
  robots: { index: false },
};

export default async function AdminProductPage({ params }: PageProps<"/admin/vendas/produtos/[productId]">) {
  const { productId } = await params;
  await requireRole("ADMIN", `/admin/vendas/produtos/${productId}`);
  const [product, courses] = await Promise.all([getProductForAdmin(productId), listCoursesForSales()]);
  if (!product) notFound();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <Link href="/admin/vendas/produtos" className="text-muted-foreground text-sm hover:underline">
          ← Produtos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
        {product.isActive ? (
          <Link href={`/comprar/${product.slug}`} className="text-sm underline" target="_blank">
            Ver a página de compra
          </Link>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do produto</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm
            product={{
              id: product.id,
              title: product.title,
              slug: product.slug,
              description: product.description,
              price: formatCentsForInput(product.priceCents),
              accessDays: product.accessDays,
              maxInstallments: product.maxInstallments,
              isActive: product.isActive,
              courseIds: product.courses.map((item) => item.courseId),
            }}
            courses={courses}
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Apagar produto</CardTitle>
          <CardDescription>
            {product._count.orders > 0
              ? `Este produto tem ${product._count.orders} pedido(s): não pode ser apagado. Para parar de vender, desmarque "Ativo".`
              : "Nunca vendeu: pode ser apagado."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionButton
            action={deleteProductAction}
            fields={{ id: product.id }}
            variant="destructive"
            disabled={product._count.orders > 0}
            confirmMessage={`Apagar o produto "${product.title}"?`}
          >
            Apagar produto
          </ActionButton>
        </CardContent>
      </Card>
    </div>
  );
}
