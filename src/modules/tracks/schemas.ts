/**
 * schemas.ts — Validação dos formulários de trilha no painel (zod).
 *
 * Quem chama: `actions.ts`. Arquivo "puro", testado em `schemas.test.ts`.
 * Paralelo em Python: cada `z.object` é um modelo do `pydantic` — confere e converte o que veio do
 * formulário (tudo chega como texto) antes de qualquer gravação.
 */
import { z } from "zod";

import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "@/modules/catalog/admin/slug";

const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());
const id = z.string().trim().min(1).max(200);
const optionalId = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => value || null);
const shortText = (max: number) => z.string().trim().max(max, `No máximo ${max} caracteres.`);

export const trackSchema = z.object({
  trackId: optionalId,
  title: z.string().trim().min(5, "O título precisa ter pelo menos 5 caracteres.").max(150, "No máximo 150 caracteres."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(SLUG_MAX_LENGTH)
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || SLUG_PATTERN.test(value), "Use só letras minúsculas sem acento, números e hífens."),
  summary: shortText(300),
  body: shortText(50_000),
  boardId: optionalId,
  productId: optionalId,
  planId: optionalId,
  isPublished: checkbox,
  // Só ao criar: já montar as etapas pelo "o que mais cai" da banca escolhida.
  fromIncidence: checkbox,
});
export type TrackFormData = z.output<typeof trackSchema>;

export const trackIdSchema = z.object({ trackId: id });

export const sectionSchema = z.object({
  trackId: id,
  sectionId: optionalId,
  title: z.string().trim().min(2, "Dê um nome à etapa (ex.: Segurança da Informação).").max(120, "No máximo 120 caracteres."),
  description: shortText(1000),
  subjectId: optionalId,
});
export type SectionFormData = z.output<typeof sectionSchema>;

export const DIRECTIONS = ["up", "down"] as const;
export const moveSchema = z.object({ id, direction: z.enum(DIRECTIONS) });
export const sectionIdSchema = z.object({ sectionId: id });
export const itemIdSchema = z.object({ itemId: id });

const note = shortText(300);
const questionGoal = z.coerce
  .number({ error: "Digite quantas questões (de 1 a 200)." })
  .int("Use um número inteiro.")
  .min(1, "A meta é de pelo menos 1 questão.")
  .max(200, "A meta é de no máximo 200 questões.");

export const lessonItemSchema = z.object({
  sectionId: id,
  lessonId: z.string().trim().min(1, "Escolha a aula.").max(200),
  note,
});

export const practiceItemSchema = z.object({
  sectionId: id,
  subjectId: z.string().trim().min(1, "Escolha o assunto.").max(200),
  boardId: optionalId,
  questionGoal,
  note,
});

// Editar um passo: a dica (qualquer passo); banca e meta (só treino); mudar de etapa.
export const updateItemSchema = z.object({
  itemId: id,
  note,
  sectionId: id,
  boardId: optionalId,
  questionGoal: questionGoal.optional(),
});
export type UpdateItemFormData = z.output<typeof updateItemSchema>;
