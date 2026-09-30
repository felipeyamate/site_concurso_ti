/**
 * schemas.ts — Validação dos formulários de afiliado (painel e área do afiliado), com zod.
 *
 * Quem chama: `actions.ts`. Arquivo "puro", testado em `schemas.test.ts`.
 * A comissão é digitada em % ("20" ou "12,5") e sai em pontos-base (2000 / 1250).
 */
import { z } from "zod";

import { AFFILIATE_CODE_PATTERN, normalizeAffiliateCode } from "./rules";

const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());
const id = z.string().trim().min(1).max(200);

// "12,5" → 1250. De 0 a 100%, com até 2 casas.
// Lido como TEXTO (parte inteira + casas decimais), sem passar por número "quebrado": em ponto
// flutuante, 0.29 * 100 dá 28.999999999999996 (em Python também) e a conta de casas falhava.
const COMMISSION_PATTERN = /^(\d{1,3})(?:[.,](\d{1,2}))?$/;
const commissionPercent = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const match = COMMISSION_PATTERN.exec(value);
    // "5" → 50 pontos-base na casa decimal ("12,5" = 12,50%); "05" → 5.
    const bps = match ? Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0")) : NaN;
    if (!match || bps > 10000) {
      ctx.addIssue({ code: "custom", message: "Comissão: um número de 0 a 100 (ex.: 20 ou 12,5)." });
      return z.NEVER;
    }
    return bps;
  });

const payoutInfo = z.string().trim().max(300, "No máximo 300 caracteres.");

export const createAffiliateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Digite o e-mail da conta da pessoa."),
  code: z
    .string()
    .transform(normalizeAffiliateCode)
    .pipe(z.string().regex(AFFILIATE_CODE_PATTERN, "Código: de 3 a 30 letras minúsculas, números ou hífen (ex.: joao-silva).")),
  commissionBps: commissionPercent,
  payoutInfo,
});

export const updateAffiliateSchema = z.object({ affiliateId: id, commissionBps: commissionPercent, payoutInfo, isActive: checkbox });

// `paymentIds`: as comissões liberadas que a página mostrava ("id1,id2,..."), para o servidor conferir.
export const payoutSchema = z.object({
  affiliateId: id,
  note: z.string().trim().max(300, "No máximo 300 caracteres."),
  paymentIds: z
    .string()
    .default("")
    .transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean))
    .pipe(z.array(id).max(5000)),
});

export const ownPayoutInfoSchema = z.object({ payoutInfo });
