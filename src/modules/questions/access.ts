/**
 * access.ts — A regra de "quem pode resolver questões e fazer simulados?".
 *
 * Quem chama: as páginas de questões e simulados (para mostrar o que o aluno pode fazer) e as
 * ações de responder/criar simulado (para decidir de verdade — a página sozinha não basta).
 *
 * A regra (PROJECT.md, seção 8):
 *  - Professor/admin, ou aluno com QUALQUER matrícula ativa (manual, compra ou assinatura):
 *    acesso completo — questões sem limite e simulados.
 *  - Conta gratuita (logada, sem matrícula ativa): até FREE_DAILY_ANSWERS respostas por dia
 *    (dia de Brasília), para experimentar. Simulados, não.
 * Quem libera o acesso continua sendo SÓ a matrícula (regra da seção 6): aqui só lemos se existe
 * uma ativa.
 *
 * Arquivo "puro", testado em `access.test.ts`.
 */
import { hasMinimumRole } from "@/modules/auth/roles";
import { startOfDayInSaoPaulo, toSaoPauloDate } from "@/modules/payments/dates";

export const FREE_DAILY_ANSWERS = 10;

export type QuestionBankLevel = "FULL" | "FREE";

/** Nível de acesso ao banco de questões. */
export function getQuestionBankLevel(input: { role: unknown; hasActiveEnrollment: boolean }): QuestionBankLevel {
  if (hasMinimumRole(input.role, "TEACHER")) return "FULL";
  return input.hasActiveEnrollment ? "FULL" : "FREE";
}

export type AnswerPermission =
  | { allowed: true; remainingFree: number | null }
  | { allowed: false; reason: "FREE_LIMIT_REACHED" };

/**
 * Pode responder mais uma questão agora?
 * `answeredToday` = quantas respostas o aluno já deu hoje (dia de Brasília; ver `startOfTodayInSaoPaulo`).
 * `remainingFree` = quantas sobram DEPOIS desta (null = sem limite).
 */
export function checkAnswerPermission(level: QuestionBankLevel, answeredToday: number): AnswerPermission {
  if (level === "FULL") return { allowed: true, remainingFree: null };
  if (answeredToday >= FREE_DAILY_ANSWERS) return { allowed: false, reason: "FREE_LIMIT_REACHED" };
  return { allowed: true, remainingFree: FREE_DAILY_ANSWERS - answeredToday - 1 };
}

/** Quantas respostas grátis ainda restam hoje (para a tela). null = sem limite. */
export function remainingFreeAnswers(level: QuestionBankLevel, answeredToday: number): number | null {
  if (level === "FULL") return null;
  return Math.max(0, FREE_DAILY_ANSWERS - answeredToday);
}

/** Simulados são do acesso completo. */
export function canUseMockExams(level: QuestionBankLevel): boolean {
  return level === "FULL";
}

/**
 * Início do "hoje" em Brasília (a cota grátis vira à meia-noite de Brasília, não à do servidor,
 * que roda em UTC). Paralelo em Python: `datetime.combine(hoje_em_sp, time.min, tzinfo=SP)`.
 */
export function startOfTodayInSaoPaulo(now: Date): Date {
  return startOfDayInSaoPaulo(toSaoPauloDate(now));
}
