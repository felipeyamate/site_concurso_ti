/**
 * schemas.ts — Validação dos formulários do painel de cursos (o que o professor digitou).
 *
 * Quem chama: as Server Actions de `actions.ts`, antes de gravar qualquer coisa.
 * O que devolve: os dados limpos e tipados, ou os erros por campo (em português).
 *
 * Paralelo em Python: cada schema é um modelo do pydantic (ou um `forms.Form` do Django).
 * Os formulários HTML mandam tudo como texto; aqui convertemos (ex.: caixa marcada → `true`).
 */
import { z } from "zod";

import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "./slug";

// Caixa de seleção (checkbox): o navegador manda "on" quando marcada e nada quando desmarcada.
const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());

const id = z.string().trim().min(1, "Item inválido.").max(200);

const title = z
  .string()
  .trim()
  .min(3, "O título precisa ter pelo menos 3 caracteres.")
  .max(150, "O título pode ter no máximo 150 caracteres.");

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .max(SLUG_MAX_LENGTH, `O endereço pode ter no máximo ${SLUG_MAX_LENGTH} caracteres.`)
  .regex(SLUG_PATTERN, "Use só letras minúsculas sem acento, números e hífens (ex.: seguranca-da-informacao).");

// Texto opcional: vazio vira `null` (no banco, "sem valor").
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Pode ter no máximo ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value));

// Número inteiro digitado num campo de texto ("" = 0).
const wholeNumber = (label: string, max: number) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? 0 : Number(value)),
    z
      .number({ error: `${label}: digite um número.` })
      .int(`${label}: use um número inteiro.`)
      .min(0, `${label}: não pode ser negativo.`)
      .max(max, `${label}: no máximo ${max}.`),
  );

export const createCourseSchema = z.object({ title });

export const updateCourseSchema = z.object({
  courseId: id,
  title,
  slug,
  subtitle: optionalText(200),
  description: z.string().trim().max(5000, "A descrição pode ter no máximo 5000 caracteres."),
  isPublished: checkbox,
});

export const createModuleSchema = z.object({ courseId: id, title });
export const renameModuleSchema = z.object({ moduleId: id, title });

export const createLessonSchema = z.object({ moduleId: id, title });

export const updateLessonSchema = z.object({
  lessonId: id,
  moduleId: id,
  title,
  slug,
  description: z.string().trim().max(5000, "A descrição pode ter no máximo 5000 caracteres."),
  isFreePreview: checkbox,
  isPublished: checkbox,
});

export const VIDEO_SOURCES = ["NONE", "PANDA", "DEV"] as const;
export type VideoSource = (typeof VIDEO_SOURCES)[number];

export const updateLessonVideoSchema = z
  .object({
    lessonId: id,
    source: z.enum(VIDEO_SOURCES, { error: "Escolha de onde vem o vídeo." }),
    // Link (ou código <iframe>) do player do Panda; conferido em `parsePandaEmbedInput`.
    pandaEmbed: z.string().trim().max(5000).default(""),
    durationMinutes: wholeNumber("Minutos", 24 * 60),
    durationSecondsPart: wholeNumber("Segundos", 59),
  })
  .transform((values) => ({
    lessonId: values.lessonId,
    source: values.source,
    pandaEmbed: values.pandaEmbed,
    durationSeconds: values.durationMinutes * 60 + values.durationSecondsPart,
  }));

export const moveSchema = z.object({ id, direction: z.enum(["up", "down"]) });

export const idSchema = z.object({ id });
