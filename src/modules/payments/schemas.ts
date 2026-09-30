/**
 * schemas.ts — Validação dos formulários de venda: checkout do aluno e cadastro de produtos/planos
 * no painel.
 *
 * Quem chama: as Server Actions (`actions.ts` e `admin/actions.ts`), antes de qualquer coisa.
 * O que devolve: dados limpos e tipados, ou os erros por campo (em português).
 * Paralelo em Python: modelos do pydantic (ou `forms.Form` do Django).
 *
 * Importante: o PREÇO nunca vem do formulário do aluno — o servidor sempre busca no banco.
 */
import { z } from "zod";

import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "@/modules/catalog/admin/slug";

import { isValidCpf, normalizeCpf } from "./cpf";
import { MAX_INSTALLMENTS, parseBRLInput } from "./money";

// Caixa de seleção (checkbox): o navegador manda "on" quando marcada e nada quando desmarcada.
const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());

const id = z.string().trim().min(1, "Item inválido.").max(200);

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .max(SLUG_MAX_LENGTH, `O endereço pode ter no máximo ${SLUG_MAX_LENGTH} caracteres.`)
  .regex(SLUG_PATTERN, "Use só letras minúsculas sem acento, números e hífens (ex.: curso-base-12-meses).");

const title = z
  .string()
  .trim()
  .min(3, "O nome precisa ter pelo menos 3 caracteres.")
  .max(150, "O nome pode ter no máximo 150 caracteres.");

const method = z.enum(["PIX", "BOLETO", "CREDIT_CARD"], { error: "Escolha a forma de pagamento." });

const cpf = z
  .string()
  .trim()
  .refine((value) => isValidCpf(value), "CPF inválido. Confira os números.")
  .transform(normalizeCpf);

// Celular com DDD (opcional): só dígitos, 10 ou 11.
const phone = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value === "" || value.length === 10 || value.length === 11, "Celular com DDD, ex.: (11) 91234-5678.")
  .transform((value) => (value === "" ? null : value));

const acceptTerms = checkbox.refine((value) => value, "Para continuar, aceite os termos de uso e a política de reembolso.");

// Cupom (Fase 6): opcional; vazio = sem cupom. O formato de verdade é conferido pelas regras do
// cupom (`coupons/rules.ts`); aqui só limitamos o tamanho.
const couponCode = z
  .string()
  .trim()
  .max(40, "Cupom inválido.")
  .optional()
  .transform((value) => (value ? value : null));

// ---------------------------------------------------------------------------------------------
// Aluno
// ---------------------------------------------------------------------------------------------

export const checkoutSchema = z.object({
  productSlug: slug,
  couponCode,
  method,
  installments: z.coerce.number().int().min(1).max(MAX_INSTALLMENTS).catch(1),
  cpf,
  phone,
  acceptTerms,
});

export const subscribeSchema = z.object({
  planSlug: slug,
  couponCode,
  method,
  cpf,
  phone,
  acceptTerms,
});

export const orderIdSchema = z.object({ orderId: id });
export const cancelSubscriptionSchema = z.object({ subscriptionId: id, refund: checkbox });

// ---------------------------------------------------------------------------------------------
// Painel (ADMIN)
// ---------------------------------------------------------------------------------------------

// Preço digitado ("97,90") → centavos (9790).
const price = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const cents = parseBRLInput(value);
    if (cents === null || cents <= 0) {
      ctx.addIssue({ code: "custom", message: "Digite o preço, ex.: 97,90." });
      return z.NEVER;
    }
    return cents;
  });

// Dias de acesso: vazio = sem data de fim.
const accessDays = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? null : Number(value)),
  z
    .number({ error: "Dias de acesso: digite um número (ou deixe vazio para sem data de fim)." })
    .int("Dias de acesso: use um número inteiro.")
    .min(1, "Dias de acesso: no mínimo 1.")
    .max(3650, "Dias de acesso: no máximo 3650 (10 anos).")
    .nullable(),
);

const maxInstallments = z.coerce
  .number({ error: "Parcelas: digite um número." })
  .int("Parcelas: use um número inteiro.")
  .min(1, "Parcelas: no mínimo 1 (à vista).")
  .max(MAX_INSTALLMENTS, `Parcelas: no máximo ${MAX_INSTALLMENTS}.`);

const description = z.string().trim().max(2000, "A descrição pode ter no máximo 2000 caracteres.");

export const createProductSchema = z.object({ title, price, accessDays, maxInstallments });

export const updateProductSchema = z.object({
  productId: id,
  title,
  slug,
  description,
  price,
  accessDays,
  maxInstallments,
  isActive: checkbox,
  courseIds: z.array(id).max(200),
});

const cycle = z.enum(["MONTHLY", "YEARLY"], { error: "Escolha o ciclo (mensal ou anual)." });

export const createPlanSchema = z.object({ title, price, cycle });

export const updatePlanSchema = z.object({
  planId: id,
  title,
  slug,
  description,
  price,
  cycle,
  isActive: checkbox,
});

export const subscriptionCoursesSchema = z.object({ courseIds: z.array(id).max(500) });

export const idSchema = z.object({ id });
