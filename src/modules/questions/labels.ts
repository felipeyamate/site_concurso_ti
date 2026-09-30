/**
 * labels.ts — Textos em português dos tipos de questão e das situações, para as telas.
 */
import type { QuestionType } from "@/generated/prisma/enums";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Múltipla escolha",
  TRUE_FALSE: "Certo ou errado",
};

export const PRACTICE_STATUS_LABELS = {
  todas: "Todas",
  "nao-respondidas": "Não respondidas",
  erradas: "Que errei",
} as const;

/** "1 questão" / "3 questões". */
export function questionsCountLabel(count: number): string {
  return count === 1 ? "1 questão" : `${count} questões`;
}
