"use client";

/**
 * checkout-form.tsx — Formulário de compra (produto) ou de assinatura (plano).
 *
 * Quem chama: /comprar/[produto] e /assinar/[plano].
 * O que envia: forma de pagamento, parcelas (só cartão, compra avulsa), CPF, celular, o aceite
 * dos termos e o cupom já aplicado na página (se houver). O PREÇO não vai no formulário: o servidor
 * busca no banco e confere o cupom de novo.
 *
 * Os dados do cartão NUNCA são digitados aqui: no cartão, o aluno paga na página segura do
 * provedor (Asaas), para onde é levado depois de criar o pedido.
 */
import Link from "next/link";
import { useState } from "react";

import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { checkoutAction, subscribeAction } from "../actions";

type Method = "PIX" | "BOLETO" | "CREDIT_CARD";

const METHODS: Array<{ value: Method; label: string; hint: string }> = [
  { value: "PIX", label: "Pix", hint: "Aprovação na hora. O QR Code aparece na próxima tela." },
  { value: "CREDIT_CARD", label: "Cartão de crédito", hint: "Você digita o cartão na página segura do Asaas." },
  { value: "BOLETO", label: "Boleto", hint: "Leva até 3 dias úteis para ser confirmado." },
];

type CheckoutFormProps = {
  kind: "product" | "plan";
  slug: string;
  // Parcelas oferecidas no cartão (compra avulsa), já com o texto (ex.: "3x de R$ 33,34").
  installmentOptions: Array<{ count: number; label: string }>;
  defaults: { cpf: string; phone: string; cpfLocked: boolean };
  submitLabel: string;
  // Cupom aplicado na página (já conferido na prévia) ou null.
  couponCode: string | null;
};

export function CheckoutForm({ kind, slug, installmentOptions, defaults, submitLabel, couponCode }: CheckoutFormProps) {
  const { state, onSubmit, pending } = useAdminForm(kind === "product" ? checkoutAction : subscribeAction);
  const [method, setMethod] = useState<Method>("PIX");
  const errors = state.fieldErrors;
  const showInstallments = kind === "product" && method === "CREDIT_CARD" && installmentOptions.length > 1;

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <input type="hidden" name={kind === "product" ? "productSlug" : "planSlug"} value={slug} />
      {couponCode ? <input type="hidden" name="couponCode" value={couponCode} /> : null}
      <FieldError id="checkout-coupon-error" message={errors.couponCode} />

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Forma de pagamento</legend>
        {METHODS.map((option) => (
          <label
            key={option.value}
            className="has-[:checked]:border-primary flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
          >
            <input
              type="radio"
              name="method"
              value={option.value}
              checked={method === option.value}
              onChange={() => setMethod(option.value)}
              className="accent-primary mt-0.5 size-4"
            />
            <span className="grid gap-0.5">
              <span className="font-medium">{option.label}</span>
              <span className="text-muted-foreground text-xs">{option.hint}</span>
            </span>
          </label>
        ))}
        <FieldError id="checkout-method-error" message={errors.method} />
      </fieldset>

      {showInstallments ? (
        <div className="grid gap-2">
          <Label htmlFor="checkout-installments">Parcelas (sem juros)</Label>
          <NativeSelect id="checkout-installments" name="installments" defaultValue="1">
            {installmentOptions.map((option) => (
              <option key={option.count} value={option.count}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
          <FieldError id="checkout-installments-error" message={errors.installments} />
        </div>
      ) : (
        <input type="hidden" name="installments" value="1" />
      )}

      <div className="grid gap-2">
        <Label htmlFor="checkout-cpf">CPF</Label>
        <Input
          id="checkout-cpf"
          name="cpf"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          defaultValue={defaults.cpf}
          readOnly={defaults.cpfLocked}
          required
          aria-invalid={errors.cpf ? true : undefined}
          aria-describedby="checkout-cpf-hint"
        />
        <p id="checkout-cpf-hint" className="text-muted-foreground text-xs">
          {defaults.cpfLocked
            ? "CPF das suas compras anteriores. Para trocar, fale com o suporte."
            : "Obrigatório para gerar a cobrança e a nota fiscal. Fica guardado para as próximas compras."}
        </p>
        <FieldError id="checkout-cpf-error" message={errors.cpf} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="checkout-phone">Celular com DDD (opcional)</Label>
        <Input
          id="checkout-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 91234-5678"
          defaultValue={defaults.phone}
          aria-invalid={errors.phone ? true : undefined}
        />
        <FieldError id="checkout-phone-error" message={errors.phone} />
      </div>

      <div className="grid gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="acceptTerms" className="accent-primary mt-0.5 size-4" />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" className="underline" target="_blank">
              termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="underline" target="_blank">
              política de privacidade
            </Link>
            . Sei que posso pedir reembolso em até 7 dias depois do pagamento.
          </span>
        </label>
        <FieldError id="checkout-terms-error" message={errors.acceptTerms} />
      </div>

      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending} size="lg">
          {pending ? "Gerando a cobrança..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
