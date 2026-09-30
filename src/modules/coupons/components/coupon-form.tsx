"use client";

/**
 * coupon-form.tsx — Formulário de cupom no painel (criar e editar).
 *
 * Quem chama: /admin/vendas/cupons (novo) e /admin/vendas/cupons/[id] (editar).
 * "use client" só para trocar o campo do desconto (% ou R$) conforme o tipo escolhido.
 * As regras (código único, código de cupom usado não muda...) ficam no servidor.
 */
import { useState } from "react";

import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { saveCouponAction } from "../actions";
import type { CouponFormValues } from "../form-values";

type Option = { id: string; title: string; isActive: boolean };
type AffiliateOption = { id: string; code: string; name: string; isActive: boolean };

export function CouponForm({
  coupon,
  products,
  plans,
  affiliates,
}: {
  coupon: CouponFormValues;
  products: Option[];
  plans: Option[];
  affiliates: AffiliateOption[];
}) {
  const { state, onSubmit, pending } = useAdminForm(saveCouponAction);
  const [discountType, setDiscountType] = useState(coupon.discountType);
  const errors = state.fieldErrors;
  const prefix = coupon.id ? "coupon" : "new-coupon";

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {coupon.id ? <input type="hidden" name="couponId" value={coupon.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-code`}>Código</Label>
          <Input
            id={`${prefix}-code`}
            name="code"
            defaultValue={coupon.code}
            required
            className="uppercase"
            placeholder="Ex.: BEMVINDO10"
            aria-invalid={errors.code ? true : undefined}
          />
          <FieldError id={`${prefix}-code-error`} message={errors.code} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-description`}>Anotação interna (opcional)</Label>
          <Input id={`${prefix}-description`} name="description" defaultValue={coupon.description} placeholder="Ex.: Campanha de lançamento" />
          <FieldError id={`${prefix}-description-error`} message={errors.description} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-type`}>Tipo de desconto</Label>
          <NativeSelect
            id={`${prefix}-type`}
            name="discountType"
            value={discountType}
            onChange={(event) => setDiscountType(event.target.value as "PERCENT" | "AMOUNT")}
          >
            <option value="PERCENT">Porcentagem (%)</option>
            <option value="AMOUNT">Valor fixo (R$)</option>
          </NativeSelect>
        </div>
        {discountType === "PERCENT" ? (
          <div className="grid gap-2">
            <Label htmlFor={`${prefix}-percent`}>Desconto (%)</Label>
            <Input id={`${prefix}-percent`} name="percentOff" inputMode="numeric" defaultValue={coupon.percentOff} aria-invalid={errors.percentOff ? true : undefined} />
            <FieldError id={`${prefix}-percent-error`} message={errors.percentOff} />
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor={`${prefix}-amount`}>Desconto (R$)</Label>
            <Input
              id={`${prefix}-amount`}
              name="amountOff"
              inputMode="decimal"
              defaultValue={coupon.amountOff}
              placeholder="20,00"
              aria-invalid={errors.amountOff ? true : undefined}
            />
            <FieldError id={`${prefix}-amount-error`} message={errors.amountOff} />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-affiliate`}>Cupom de um afiliado (opcional)</Label>
          <NativeSelect id={`${prefix}-affiliate`} name="affiliateId" defaultValue={coupon.affiliateId}>
            <option value="">Nenhum</option>
            {affiliates.map((affiliate) => (
              <option key={affiliate.id} value={affiliate.id}>
                {affiliate.name} ({affiliate.code}){affiliate.isActive ? "" : " — inativo"}
              </option>
            ))}
          </NativeSelect>
          <FieldError id={`${prefix}-affiliate-error`} message={errors.affiliateId} />
        </div>
      </div>

      <fieldset className="grid gap-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Onde vale</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="appliesToProducts" defaultChecked={coupon.appliesToProducts} className="accent-primary size-4" />
          Compras avulsas (produtos)
        </label>
        {products.length > 0 ? (
          <div className="grid gap-1 pl-6">
            <span className="text-muted-foreground text-xs">Só nestes produtos (nenhum marcado = todos):</span>
            {products.map((product) => (
              <label key={product.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="productIds" value={product.id} defaultChecked={coupon.productIds.includes(product.id)} className="accent-primary size-4" />
                {product.title}
                {product.isActive ? null : <span className="text-muted-foreground text-xs">(inativo)</span>}
              </label>
            ))}
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="appliesToPlans" defaultChecked={coupon.appliesToPlans} className="accent-primary size-4" />
          Assinaturas (planos) — o desconto vale em TODAS as renovações
        </label>
        {plans.length > 0 ? (
          <div className="grid gap-1 pl-6">
            <span className="text-muted-foreground text-xs">Só nestes planos (nenhum marcado = todos):</span>
            {plans.map((plan) => (
              <label key={plan.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="planIds" value={plan.id} defaultChecked={coupon.planIds.includes(plan.id)} className="accent-primary size-4" />
                {plan.title}
                {plan.isActive ? null : <span className="text-muted-foreground text-xs">(inativo)</span>}
              </label>
            ))}
          </div>
        ) : null}
        <FieldError id={`${prefix}-applies-error`} message={errors.appliesToProducts} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-starts`}>Vale a partir de</Label>
          <Input id={`${prefix}-starts`} name="startsOn" type="date" defaultValue={coupon.startsOn} aria-invalid={errors.startsOn ? true : undefined} />
          <FieldError id={`${prefix}-starts-error`} message={errors.startsOn} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-ends`}>Vale até (o dia todo)</Label>
          <Input id={`${prefix}-ends`} name="endsOn" type="date" defaultValue={coupon.endsOn} aria-invalid={errors.endsOn ? true : undefined} />
          <FieldError id={`${prefix}-ends-error`} message={errors.endsOn} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-max`}>Usos no total</Label>
          <Input
            id={`${prefix}-max`}
            name="maxRedemptions"
            inputMode="numeric"
            defaultValue={coupon.maxRedemptions}
            placeholder="sem limite"
            aria-invalid={errors.maxRedemptions ? true : undefined}
          />
          <FieldError id={`${prefix}-max-error`} message={errors.maxRedemptions} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-per-user`}>Usos por aluno</Label>
          <Input id={`${prefix}-per-user`} name="maxPerUser" inputMode="numeric" defaultValue={coupon.maxPerUser} aria-invalid={errors.maxPerUser ? true : undefined} />
          <FieldError id={`${prefix}-per-user-error`} message={errors.maxPerUser} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={coupon.isActive} className="accent-primary size-4" />
        Ativo
      </label>
      <p className="text-muted-foreground text-xs">
        O preço com desconto nunca fica abaixo de R$ 5,00 (mínimo de cobrança). Mudar o desconto não altera vendas já feitas.
      </p>
      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : coupon.id ? "Salvar cupom" : "Criar cupom"}
        </Button>
      </div>
    </form>
  );
}
