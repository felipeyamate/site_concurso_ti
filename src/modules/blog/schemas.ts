/**
 * schemas.ts — Validação do formulário de post do blog (painel), com zod.
 *
 * Quem chama: `actions.ts`. Arquivo "puro", testado em `schemas.test.ts`.
 * Slug vazio = o servidor gera a partir do título (ex.: "O que é phishing?" → "o-que-e-phishing").
 */
import { z } from "zod";

import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "@/modules/catalog/admin/slug";

const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());
const optionalId = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => value || null);

export const BLOG_BODY_MAX = 50_000;

export const blogPostSchema = z.object({
  postId: optionalId,
  title: z.string().trim().min(5, "O título precisa ter pelo menos 5 caracteres.").max(150, "O título pode ter no máximo 150 caracteres."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(SLUG_MAX_LENGTH, `O endereço pode ter no máximo ${SLUG_MAX_LENGTH} caracteres.`)
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || SLUG_PATTERN.test(value), "Use só letras minúsculas sem acento, números e hífens."),
  excerpt: z.string().trim().max(300, "O resumo pode ter no máximo 300 caracteres."),
  body: z.string().trim().min(50, "Escreva o texto do post (pelo menos 50 caracteres).").max(BLOG_BODY_MAX, "O texto está grande demais."),
  subjectId: optionalId,
  isPublished: checkbox,
});

export type BlogPostFormData = z.output<typeof blogPostSchema>;

export const blogPostIdSchema = z.object({ postId: z.string().trim().min(1).max(200) });
