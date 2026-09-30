/**
 * schemas.ts — Validação do formulário de cupom do painel (zod, parecido com o `pydantic`).
 *
 * Quem chama: `actions.ts` (ação "Salvar cupom"). Arquivo "puro", testado em `schemas.test.ts`.
 * O que devolve: os dados prontos para gravar — o desconto já em número (% ou centavos) e as datas
 * como dias ("AAAA-MM-DD"; o servidor converte para o começo/fim do dia em Brasília).
 */
import { z } from "zod";

import { parseBRLInput } from "@/modules/payments/money";

import { COUPON_CODE_PATTERN, normalizeCouponCode } from "./rules";

const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());
const id = z.string().trim().min(1).max(200);
const optionalId = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => value || null);

// Dia digitado num campo de data ("2026-10-01") ou vazio.
const optionalDay = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
      ctx.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    return value;
  });

const optionalLimit = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? null : Number(value)),
  z.number({ error: "Digite um número (ou deixe vazio para sem limite)." }).int("Use um número inteiro.").min(1, "No mínimo 1.").max(1_000_000).nullable(),
);

export const couponFormSchema = z
  .object({
    couponId: optionalId,
    code: z
      .string()
      .transform(normalizeCouponCode)
      .pipe(z.string().regex(COUPON_CODE_PATTERN, "Código: de 3 a 30 letras, números, hífen ou sublinhado (ex.: BEMVINDO10).")),
    description: z.string().trim().max(200, "A anotação pode ter no máximo 200 caracteres."),
    discountType: z.enum(["PERCENT", "AMOUNT"], { error: "Escolha o tipo de desconto." }),
    percentOff: z.string().trim().optional().default(""),
    amountOff: z.string().trim().optional().default(""),
    appliesToProducts: checkbox,
    appliesToPlans: checkbox,
    productIds: z.array(id).max(200).default([]),
    planIds: z.array(id).max(200).default([]),
    startsOn: optionalDay,
    endsOn: optionalDay,
    maxRedemptions: optionalLimit,
    maxPerUser: z.coerce.number({ error: "Digite um número." }).int("Use um número inteiro.").min(1, "No mínimo 1.").max(100, "No máximo 100."),
    affiliateId: optionalId,
    isActive: checkbox,
  })
  .transform((data, ctx) => {
    // O desconto vem de um campo ou do outro, conforme o tipo escolhido.
    let discountValue = 0;
    if (data.discountType === "PERCENT") {
      const percent = Number(data.percentOff.replace(",", "."));
      if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
        ctx.addIssue({ code: "custom", path: ["percentOff"], message: "Porcentagem: um número inteiro de 1 a 100." });
      }
      discountValue = percent;
    } else {
      const cents = parseBRLInput(data.amountOff);
      if (cents === null || cents <= 0) {
        ctx.addIssue({ code: "custom", path: ["amountOff"], message: "Digite o valor do desconto, ex.: 20,00." });
      }
      discountValue = cents ?? 0;
    }
    if (!data.appliesToProducts && !data.appliesToPlans) {
      ctx.addIssue({ code: "custom", path: ["appliesToProducts"], message: "Marque onde o cupom vale: compras avulsas e/ou assinaturas." });
    }
    if (data.startsOn && data.endsOn && data.endsOn < data.startsOn) {
      ctx.addIssue({ code: "custom", path: ["endsOn"], message: "O fim não pode ser antes do começo." });
    }
    // Devolve os campos um a um (sem `percentOff`/`amountOff`, que viraram `discountValue`).
    return {
      couponId: data.couponId,
      code: data.code,
      description: data.description,
      discountType: data.discountType,
      appliesToProducts: data.appliesToProducts,
      appliesToPlans: data.appliesToPlans,
      startsOn: data.startsOn,
      endsOn: data.endsOn,
      maxRedemptions: data.maxRedemptions,
      maxPerUser: data.maxPerUser,
      affiliateId: data.affiliateId,
      isActive: data.isActive,
      discountValue,
      // Restrição de um tipo desmarcado não faz sentido: descarta.
      productIds: data.appliesToProducts ? data.productIds : [],
      planIds: data.appliesToPlans ? data.planIds : [],
    };
  });

export type CouponFormData = z.output<typeof couponFormSchema>;

export const couponIdSchema = z.object({ couponId: id });
