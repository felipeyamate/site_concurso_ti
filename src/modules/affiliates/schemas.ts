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
const commissionPercent = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const percent = Number(value.replace(",", "."));
    if (value === "" || !Number.isFinite(percent) || percent < 0 || percent > 100 || Math.round(percent * 100) !== percent * 100) {
      ctx.addIssue({ code: "custom", message: "Comissão: um número de 0 a 100 (ex.: 20 ou 12,5)." });
      return z.NEVER;
    }
    return Math.round(percent * 100);
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

export const payoutSchema = z.object({ affiliateId: id, note: z.string().trim().max(300, "No máximo 300 caracteres.") });

export const ownPayoutInfoSchema = z.object({ payoutInfo });
