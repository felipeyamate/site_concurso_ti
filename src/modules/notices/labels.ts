/**
 * labels.ts — Textos em português da situação de um concurso (páginas de edital).
 */
import type { ExamNoticeStatus } from "@/generated/prisma/enums";

export const NOTICE_STATUS_LABELS: Record<ExamNoticeStatus, string> = {
  EXPECTED: "Previsto",
  OPEN: "Inscrições abertas",
  CLOSED: "Inscrições encerradas",
  DONE: "Prova aplicada",
};

// Ordem na lista de concursos: primeiro os que o aluno ainda pode fazer.
export const NOTICE_STATUS_ORDER: Record<ExamNoticeStatus, number> = { OPEN: 0, EXPECTED: 1, CLOSED: 2, DONE: 3 };
