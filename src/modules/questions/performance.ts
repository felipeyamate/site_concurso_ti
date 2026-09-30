/**
 * performance.ts — Contas do "Meu desempenho": taxa de acerto por assunto e os pontos fracos.
 *
 * Quem chama: `performance.server.ts` (que soma as respostas no banco) e a página de desempenho.
 * Arquivo "puro", testado em `performance.test.ts`.
 */

// Com menos respostas que isso num assunto, a porcentagem ainda não diz muito: o assunto não
// entra em "pontos fracos" (aparece na tabela, mas sem virar recomendação).
export const MIN_ATTEMPTS_FOR_RANKING = 5;
// Abaixo disso (em %), o assunto é um ponto fraco.
export const WEAK_ACCURACY_PERCENT = 60;

/** Porcentagem inteira de acertos (0 respostas = 0%). */
export function accuracyPercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

export type SubjectTotals = { subjectId: string; name: string; slug: string; attempts: number; correct: number };
export type SubjectPerformance = SubjectTotals & { percent: number; isWeak: boolean };

/**
 * Monta a tabela por assunto.
 * Ordem: primeiro os pontos fracos (menor porcentagem primeiro), depois os demais do mais
 * respondido para o menos — o aluno vê logo o que precisa treinar.
 */
export function summarizeBySubject(rows: readonly SubjectTotals[]): SubjectPerformance[] {
  const withPercent = rows.map((row) => {
    const percent = accuracyPercent(row.correct, row.attempts);
    return { ...row, percent, isWeak: row.attempts >= MIN_ATTEMPTS_FOR_RANKING && percent < WEAK_ACCURACY_PERCENT };
  });
  return withPercent.sort((a, b) => {
    if (a.isWeak !== b.isWeak) return a.isWeak ? -1 : 1;
    if (a.isWeak && b.isWeak && a.percent !== b.percent) return a.percent - b.percent;
    if (a.attempts !== b.attempts) return b.attempts - a.attempts;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export type PerformanceTotals = { attempts: number; correct: number; percent: number };

/** Totais gerais (soma de todos os assuntos). */
export function overallTotals(rows: readonly SubjectTotals[]): PerformanceTotals {
  const attempts = rows.reduce((sum, row) => sum + row.attempts, 0);
  const correct = rows.reduce((sum, row) => sum + row.correct, 0);
  return { attempts, correct, percent: accuracyPercent(correct, attempts) };
}
