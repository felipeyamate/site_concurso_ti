"use client";

/**
 * product-forms.tsx — Formulários de PRODUTO no painel de vendas: "Novo produto" e "Dados do produto".
 *
 * Quem chama: /admin/vendas/produtos (novo) e /admin/vendas/produtos/[id] (editar).
 * As regras (preço válido, endereço único, só ativa com curso) ficam no servidor.
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createProductAction, updateProductAction } from "../actions";

export function NewProductForm() {
  const { state, onSubmit, pending } = useAdminForm(createProductAction);
  const errors = state.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="new-product-title">Nome do produto</Label>
        <Input id="new-product-title" name="title" required placeholder="Ex.: Curso Base — 12 meses" aria-invalid={errors.title ? true : undefined} />
        <FieldError id="new-product-title-error" message={errors.title} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-product-price">Preço (R$)</Label>
        <Input id="new-product-price" name="price" inputMode="decimal" required placeholder="197,00" aria-invalid={errors.price ? true : undefined} />
        <FieldError id="new-product-price-error" message={errors.price} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-product-days">Dias de acesso (vazio = sem data de fim)</Label>
        <Input id="new-product-days" name="accessDays" inputMode="numeric" defaultValue="365" aria-invalid={errors.accessDays ? true : undefined} />
        <FieldError id="new-product-days-error" message={errors.accessDays} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-product-installments">Máximo de parcelas no cartão</Label>
        <Input
          id="new-product-installments"
          name="maxInstallments"
          inputMode="numeric"
          defaultValue="12"
          aria-invalid={errors.maxInstallments ? true : undefined}
        />
        <FieldError id="new-product-installments-error" message={errors.maxInstallments} />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Criando..." : "Criar produto"}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <FormStatus state={state} />
      </div>
    </form>
  );
}

type ProductDetails = {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: string; // já formatado para o campo ("197,00")
  accessDays: number | null;
  maxInstallments: number;
  isActive: boolean;
  courseIds: string[];
};

type CourseOption = { id: string; title: string; isPublished: boolean };

export function ProductForm({ product, courses }: { product: ProductDetails; courses: CourseOption[] }) {
  const { state, onSubmit, pending } = useAdminForm(updateProductAction);
  const errors = state.fieldErrors;
  const selected = new Set(product.courseIds);

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="productId" value={product.id} />

      <div className="grid gap-2">
        <Label htmlFor="product-title">Nome</Label>
        <Input id="product-title" name="title" defaultValue={product.title} required aria-invalid={errors.title ? true : undefined} />
        <FieldError id="product-title-error" message={errors.title} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="product-slug">Endereço (slug)</Label>
        <Input id="product-slug" name="slug" defaultValue={product.slug} required aria-invalid={errors.slug ? true : undefined} />
        <p className="text-muted-foreground text-xs">
          Página de compra: /comprar/<strong>{product.slug}</strong>
        </p>
        <FieldError id="product-slug-error" message={errors.slug} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="product-description">Descrição (aparece no checkout)</Label>
        <Textarea id="product-description" name="description" defaultValue={product.description} rows={3} aria-invalid={errors.description ? true : undefined} />
        <FieldError id="product-description-error" message={errors.description} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="product-price">Preço (R$)</Label>
          <Input id="product-price" name="price" inputMode="decimal" defaultValue={product.price} required aria-invalid={errors.price ? true : undefined} />
          <FieldError id="product-price-error" message={errors.price} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="product-days">Dias de acesso</Label>
          <Input
            id="product-days"
            name="accessDays"
            inputMode="numeric"
            defaultValue={product.accessDays ?? ""}
            placeholder="vazio = sem fim"
            aria-invalid={errors.accessDays ? true : undefined}
          />
          <FieldError id="product-days-error" message={errors.accessDays} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="product-installments">Parcelas (máx.)</Label>
          <Input
            id="product-installments"
            name="maxInstallments"
            inputMode="numeric"
            defaultValue={product.maxInstallments}
            aria-invalid={errors.maxInstallments ? true : undefined}
          />
          <FieldError id="product-installments-error" message={errors.maxInstallments} />
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Cursos que este produto libera</legend>
        {courses.length === 0 ? <p className="text-muted-foreground text-sm">Nenhum curso cadastrado ainda.</p> : null}
        {courses.map((course) => (
          <label key={course.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="courseIds" value={course.id} defaultChecked={selected.has(course.id)} className="accent-primary size-4" />
            {course.title}
            {course.isPublished ? null : <span className="text-muted-foreground text-xs">(rascunho)</span>}
          </label>
        ))}
        <FieldError id="product-courses-error" message={errors.courseIds} />
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={product.isActive} className="accent-primary size-4" />
        Ativo (à venda: aparece na página dos cursos incluídos)
      </label>

      <p className="text-muted-foreground text-xs">
        Mudar preço, dias ou cursos não altera compras já feitas: cada pedido guarda o que foi comprado.
      </p>
      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar produto"}
        </Button>
      </div>
    </form>
  );
}
