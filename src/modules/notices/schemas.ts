/**
 * schemas.ts — Validação do formulário de página de edital (painel), com zod.
 *
 * Quem chama: `actions.ts`. Arquivo "puro", testado em `schemas.test.ts`.
 * Datas como dias ("AAAA-MM-DD"); link oficial só https; cupom no formato dos cupons.
 */
import { z } from "zod";

import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "@/modules/catalog/admin/slug";
import { COUPON_CODE_PATTERN, normalizeCouponCode } from "@/modules/coupons/rules";

const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());
const id = z.string().trim().min(1).max(200);
const optionalId = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => value || null);
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
const shortText = (max: number) => z.string().trim().max(max, `No máximo ${max} caracteres.`);

export const NOTICE_STATUSES = ["EXPECTED", "OPEN", "CLOSED", "DONE"] as const;

export const noticeSchema = z.object({
  noticeId: optionalId,
  title: z.string().trim().min(5, "O título precisa ter pelo menos 5 caracteres.").max(150, "No máximo 150 caracteres."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(SLUG_MAX_LENGTH)
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || SLUG_PATTERN.test(value), "Use só letras minúsculas sem acento, números e hífens."),
  organization: z.string().trim().min(2, "Digite o órgão (ex.: Banco do Brasil).").max(120),
  role: shortText(150),
  boardId: optionalId,
  status: z.enum(NOTICE_STATUSES, { error: "Escolha a situação." }),
  registrationEndsOn: optionalDay,
  examDate: optionalDay,
  vacancies: shortText(120),
  salary: shortText(120),
  summary: shortText(300),
  body: shortText(50_000),
  officialUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || /^https:\/\/[^\s]+$/.test(value), "Cole o link completo, começando com https://"),
  productId: optionalId,
  planId: optionalId,
  couponCode: z
    .string()
    .optional()
    .transform((value) => (value ? normalizeCouponCode(value) : null))
    .refine((value) => value === null || COUPON_CODE_PATTERN.test(value), "Código de cupom inválido."),
  subjectIds: z.array(id).max(50).default([]),
  // Fase 8: a trilha de estudos indicada na página (opcional).
  trackId: optionalId,
  isPublished: checkbox,
});

export type NoticeFormData = z.output<typeof noticeSchema>;

export const noticeIdSchema = z.object({ noticeId: id });
