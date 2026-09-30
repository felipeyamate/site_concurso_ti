/**
 * question-meta.tsx — O cabeçalho de uma questão (assunto · banca · prova/ano · tipo) e o enunciado.
 *
 * Quem chama: o cartão de "Resolver questões", a tela do simulado e o resultado do simulado.
 * O enunciado é texto puro: o React mostra como texto (nada de HTML vindo do banco) e as
 * quebras de linha digitadas pelo professor são mantidas (`whitespace-pre-line`).
 */
import { Badge } from "@/components/ui/badge";
import type { QuestionType } from "@/generated/prisma/enums";

import { QUESTION_TYPE_LABELS } from "../labels";

export type QuestionMetaData = {
  type: QuestionType;
  statement: string;
  subject: { name: string };
  board: { name: string } | null;
  exam: { name: string; year: number } | null;
};

export function QuestionMeta({ question, number }: { question: QuestionMetaData; number?: number }) {
  const source = question.exam
    ? `${question.board?.name ? `${question.board.name} · ` : ""}${question.exam.name} (${question.exam.year})`
    : question.board
      ? `Inédita, no estilo ${question.board.name}`
      : "Inédita";
  return (
    <div className="grid gap-3">
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        {number !== undefined ? <span className="text-foreground font-semibold">Questão {number}</span> : null}
        <Badge variant="secondary">{question.subject.name}</Badge>
        <span>{source}</span>
        <span>· {QUESTION_TYPE_LABELS[question.type]}</span>
      </div>
      <p className="leading-relaxed whitespace-pre-line">{question.statement}</p>
    </div>
  );
}
