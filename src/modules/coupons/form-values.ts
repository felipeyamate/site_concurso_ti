/**
 * form-values.ts — Os valores do formulário de cupom (tipo) e o cupom "em branco" do formulário novo.
 *
 * Quem chama: a página /admin/vendas/cupons (servidor) e o formulário `components/coupon-form.tsx`
 * (navegador). Arquivo "puro" de propósito: um arquivo com "use client" só pode exportar componentes
 * (regra do CLAUDE.md) — no servidor, um valor exportado de lá vira uma "referência" e não o objeto.
 */

export type CouponFormValues = {
  id: string | null;
  code: string;
  description: string;
  discountType: "PERCENT" | "AMOUNT";
  percentOff: string;
  amountOff: string; // já formatado ("20,00")
  appliesToProducts: boolean;
  appliesToPlans: boolean;
  productIds: string[];
  planIds: string[];
  startsOn: string;
  endsOn: string;
  maxRedemptions: string;
  maxPerUser: string;
  affiliateId: string;
  isActive: boolean;
};

export const EMPTY_COUPON: CouponFormValues = {
  id: null,
  code: "",
  description: "",
  discountType: "PERCENT",
  percentOff: "10",
  amountOff: "",
  appliesToProducts: true,
  appliesToPlans: false,
  productIds: [],
  planIds: [],
  startsOn: "",
  endsOn: "",
  maxRedemptions: "",
  maxPerUser: "1",
  affiliateId: "",
  isActive: true,
};
