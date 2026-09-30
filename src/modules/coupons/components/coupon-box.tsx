/**
 * coupon-box.tsx — O quadro do cupom nas páginas de compra/assinatura.
 *
 * Quem chama: /comprar/[produto] e /assinar/[plano], com o resultado de `previewCoupon`.
 * Mostra: o cupom aplicado (e o desconto), o motivo de um cupom não valer, ou o campo "Tem um cupom?".
 *
 * O campo é um formulário GET comum: "Aplicar" recarrega a página com `?cupom=CODIGO` e o servidor
 * calcula o preço. Funciona sem JavaScript e o mesmo endereço serve para links com cupom (ex.: na
 * página de um edital ou na divulgação de um afiliado).
 */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/modules/payments/money";

import type { CouponPreview } from "../coupons.server";

export const COUPON_PARAM = "cupom";

export function CouponBox({ preview, pagePath }: { preview: CouponPreview | null; pagePath: string }) {
  if (preview?.ok) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-green-600/40 bg-green-50 p-3 text-sm dark:bg-green-950/30">
        <span>
          Cupom <strong>{preview.code}</strong> aplicado: −{formatBRL(preview.discountCents)}.
        </span>
        <Link href={pagePath} className="underline">
          Remover cupom
        </Link>
      </div>
    );
  }
  return (
    <form method="get" action={pagePath} className="grid gap-2">
      <Label htmlFor="coupon-input">Tem um cupom de desconto?</Label>
      <div className="flex gap-2">
        <Input
          id="coupon-input"
          name={COUPON_PARAM}
          defaultValue={preview?.code ?? ""}
          autoComplete="off"
          maxLength={40}
          className="max-w-56 uppercase"
          aria-invalid={preview ? true : undefined}
          aria-describedby={preview ? "coupon-error" : undefined}
        />
        <Button type="submit" variant="outline">
          Aplicar
        </Button>
      </div>
      {preview ? (
        <p id="coupon-error" role="alert" className="text-destructive text-sm">
          {preview.message}
        </p>
      ) : null}
    </form>
  );
}
