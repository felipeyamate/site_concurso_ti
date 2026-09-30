/**
 * schemas.ts — Validação do que chega dos formulários do banco de questões (aluno e painel) e
 * dos filtros da URL.
 *
 * Quem chama: as Server Actions (`actions.ts`, `admin/actions.ts`) e as páginas (filtros).
 * O que devolve: os dados limpos e tipados, ou os erros por campo (em português).
 * Paralelo em Python: cada schema é um modelo do pydantic.
 */
import { z } from "zod";

import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "@/modules/catalog/admin/slug";

import { OPTION_LABELS, validateQuestionContent } from "./answers";
import { QUESTION_LIMITS } from "./limits";
import { MOCK_EXAM_SIZES, MOCK_EXAM_TIME_LIMITS } from "./mock-exam";

const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());
const id = z.string().trim().min(1, "Item inválido.").max(200);
// Campo de seleção opcional: "" (nenhum) vira null.
const optionalId = z
  .string()
  .trim()
  .max(200)
  .transform((value) => (value === "" ? null : value));

const name = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `O nome precisa ter pelo menos ${min} caracteres.`)
    .max(max, `O nome pode ter no máximo ${max} caracteres.`);

// Endereço (slug) opcional: vazio = gerado a partir do nome.
const optionalSlug = z
  .string()
  .trim()
  .toLowerCase()
  .max(SLUG_MAX_LENGTH, `O identificador pode ter no máximo ${SLUG_MAX_LENGTH} caracteres.`)
  .refine((value) => value === "" || SLUG_PATTERN.test(value), "Use só letras minúsculas sem acento, números e hífens.")
  .transform((value) => (value === "" ? null : value));

const answerLetter = z.enum(OPTION_LABELS, { error: "Resposta inválida." });

// ---------------------------------------------------------------------------------------------
// Painel: bancas, assuntos, provas
// ---------------------------------------------------------------------------------------------

export const boardSchema = z.object({ boardId: optionalId.optional(), name: name(2, 80), slug: optionalSlug });

export const subjectSchema = z.object({
  subjectId: optionalId.optional(),
  name: name(2, 120),
  slug: optionalSlug,
  position: z.preprocess(
    (value) => (value === "" || value === undefined ? 0 : Number(value)),
    z.number({ error: "Ordem: digite um número." }).int("Ordem: use um número inteiro.").min(0).max(9999),
  ),
});

export const examSchema = z.object({
  examId: optionalId.optional(),
  name: name(3, 150),
  slug: optionalSlug,
  year: z.preprocess(
    (value) => Number(value),
    z.number({ error: "Ano: digite um número." }).int("Ano inválido.").min(1990, "Ano inválido.").max(2100, "Ano inválido."),
  ),
  boardId: id,
});

export const deleteByIdSchema = z.object({ id });

// ---------------------------------------------------------------------------------------------
// Painel: questão
// ---------------------------------------------------------------------------------------------

const text = (label: string, max: number) =>
  z.string().trim().min(1, `${label}: preencha.`).max(max, `${label}: no máximo ${max} caracteres.`);

/**
 * Formulário da questão. Os campos `optionA`...`optionE` viram a lista de alternativas (até a
 * última preenchida); a montagem (sequência A, B, C..., gabarito) é conferida pela mesma regra
 * da importação (`validateQuestionContent`).
 */
export const questionSchema = z
  .object({
    questionId: optionalId.optional(),
    code: z
      .string()
      .trim()
      .max(QUESTION_LIMITS.code, `Código: no máximo ${QUESTION_LIMITS.code} caracteres.`)
      .transform((value) => (value === "" ? null : value)),
    type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE"], { error: "Escolha o tipo da questão." }),
    statement: text("Enunciado", QUESTION_LIMITS.statement),
    optionA: z.string().trim().max(QUESTION_LIMITS.option).default(""),
    optionB: z.string().trim().max(QUESTION_LIMITS.option).default(""),
    optionC: z.string().trim().max(QUESTION_LIMITS.option).default(""),
    optionD: z.string().trim().max(QUESTION_LIMITS.option).default(""),
    optionE: z.string().trim().max(QUESTION_LIMITS.option).default(""),
    correctAnswer: z.string().trim().toUpperCase(),
    explanation: text("Comentário", QUESTION_LIMITS.explanation),
    subjectId: id,
    examId: optionalId,
    boardId: optionalId,
    isPublished: checkbox,
  })
  .transform((value) => {
    const texts = [value.optionA, value.optionB, value.optionC, value.optionD, value.optionE];
    const lastFilled = texts.reduce((last, option, index) => (option ? index : last), -1);
    const options =
      value.type === "MULTIPLE_CHOICE" ? texts.slice(0, lastFilled + 1).map((option, index) => ({ label: OPTION_LABELS[index], text: option })) : [];
    return { ...value, options };
  })
  .superRefine((value, context) => {
    for (const message of validateQuestionContent(value)) {
      context.addIssue({ code: "custom", message, path: ["correctAnswer"] });
    }
    if (value.type === "TRUE_FALSE" && [value.optionA, value.optionB, value.optionC, value.optionD, value.optionE].some(Boolean)) {
      context.addIssue({ code: "custom", message: "Questão de Certo/Errado não tem alternativas: apague os textos.", path: ["optionA"] });
    }
  });
export type QuestionFormData = z.infer<typeof questionSchema>;

// ---------------------------------------------------------------------------------------------
// Aluno
// ---------------------------------------------------------------------------------------------

export const answerSchema = z.object({ questionId: id, answer: answerLetter });

export const createMockExamSchema = z.object({
  boardId: optionalId,
  subjectIds: z.array(id).max(50, "Escolha no máximo 50 assuntos."),
  count: z.preprocess(
    (value) => Number(value),
    z.number().refine((count) => (MOCK_EXAM_SIZES as readonly number[]).includes(count), "Escolha a quantidade de questões."),
  ),
  timeLimitMinutes: z.preprocess(
    (value) => (value === "" || value === undefined || value === "none" ? null : Number(value)),
    z.number().nullable().refine((minutes) => (MOCK_EXAM_TIME_LIMITS as readonly (number | null)[]).includes(minutes), "Escolha o tempo."),
  ),
});

export const saveMockAnswerSchema = z.object({
  mockExamId: id,
  questionId: id,
  // "" = desmarcar (deixar em branco).
  answer: z.union([answerLetter, z.literal("")]).transform((value) => (value === "" ? null : value)),
});

export const mockExamIdSchema = z.object({ mockExamId: id });

// ---------------------------------------------------------------------------------------------
// Filtros de "Resolver questões" (vêm da URL: ?assunto=...&banca=...)
// ---------------------------------------------------------------------------------------------

export const PRACTICE_STATUSES = ["todas", "nao-respondidas", "erradas"] as const;
export type PracticeStatus = (typeof PRACTICE_STATUSES)[number];
export const PRACTICE_TYPES = ["multipla-escolha", "certo-errado"] as const;

export type PracticeFilters = {
  subject: string | null; // slug
  board: string | null; // slug
  exam: string | null; // slug
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | null;
  status: PracticeStatus;
  page: number;
};

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));
const slugOrNull = (value: string): string | null => (value && SLUG_PATTERN.test(value) && value.length <= SLUG_MAX_LENGTH ? value : null);

/**
 * Lê os filtros da URL sem nunca falhar: valor estranho = filtro ignorado (a URL é digitável).
 */
export function parsePracticeFilters(params: Record<string, string | string[] | undefined>): PracticeFilters {
  const type = first(params.tipo);
  const status = first(params.situacao);
  const page = Number.parseInt(first(params.pagina), 10);
  return {
    subject: slugOrNull(first(params.assunto)),
    board: slugOrNull(first(params.banca)),
    exam: slugOrNull(first(params.prova)),
    type: type === "multipla-escolha" ? "MULTIPLE_CHOICE" : type === "certo-errado" ? "TRUE_FALSE" : null,
    status: (PRACTICE_STATUSES as readonly string[]).includes(status) ? (status as PracticeStatus) : "todas",
    page: Number.isFinite(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

/** Os filtros de volta em forma de URL (para links de página e "limpar filtro"). */
export function practiceFiltersToQuery(filters: Omit<PracticeFilters, "page">, page?: number): string {
  const query = new URLSearchParams();
  if (filters.subject) query.set("assunto", filters.subject);
  if (filters.board) query.set("banca", filters.board);
  if (filters.exam) query.set("prova", filters.exam);
  if (filters.type) query.set("tipo", filters.type === "MULTIPLE_CHOICE" ? "multipla-escolha" : "certo-errado");
  if (filters.status !== "todas") query.set("situacao", filters.status);
  if (page && page > 1) query.set("pagina", String(page));
  const text = query.toString();
  return text ? `?${text}` : "";
}
