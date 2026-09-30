/**
 * mock-exam.ts — Regras dos simulados: tamanhos e tempos permitidos, sorteio das questões,
 * prazo (com tolerância) e nota.
 *
 * Quem chama: `mock-exams.server.ts` (criar, salvar resposta, finalizar) e as telas.
 * Arquivo "puro", testado em `mock-exam.test.ts`.
 */

// Quantidades de questões que o aluno pode escolher.
export const MOCK_EXAM_SIZES = [10, 20, 30, 40, 50, 60] as const;
// Tempos de prova, em minutos (null = sem limite de tempo).
export const MOCK_EXAM_TIME_LIMITS = [null, 15, 30, 60, 90, 120, 180, 240] as const;
// Simulados em aberto ao mesmo tempo (evita sortear dezenas e abandonar).
export const MAX_OPEN_MOCK_EXAMS = 3;
// Tolerância depois do tempo esgotado para uma resposta chegar (a internet pode atrasar o envio).
export const DEADLINE_GRACE_SECONDS = 30;

/**
 * Embaralha uma lista (algoritmo de Fisher–Yates) sem alterar a original.
 * `random` devolve um número em [0, 1) — nos testes, passamos um previsível.
 * Paralelo em Python: `random.sample(lista, len(lista))`.
 */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/**
 * Sorteia as questões do simulado.
 * Passos: separa as que o aluno ainda NÃO respondeu das já respondidas; embaralha cada grupo;
 * pega primeiro as não respondidas (o simulado serve para ver coisa nova) e completa com as
 * respondidas, se faltar. Devolve até `count` IDs (menos, se não houver questões suficientes).
 */
export function drawMockExamQuestions(input: {
  candidateIds: readonly string[];
  answeredIds: ReadonlySet<string>;
  count: number;
  random: () => number;
}): string[] {
  const fresh = input.candidateIds.filter((id) => !input.answeredIds.has(id));
  const seen = input.candidateIds.filter((id) => input.answeredIds.has(id));
  return [...shuffle(fresh, input.random), ...shuffle(seen, input.random)].slice(0, input.count);
}

/** Hora em que o tempo de prova acaba (null = sem limite). */
export function mockExamDeadline(startedAt: Date, timeLimitMinutes: number | null): Date | null {
  if (timeLimitMinutes === null) return null;
  return new Date(startedAt.getTime() + timeLimitMinutes * 60 * 1000);
}

/**
 * O tempo acabou? Com `graceSeconds`, conta a tolerância (para aceitar uma resposta enviada
 * no último segundo que chegou um pouco depois).
 */
export function isPastDeadline(input: {
  startedAt: Date;
  timeLimitMinutes: number | null;
  now: Date;
  graceSeconds?: number;
}): boolean {
  const deadline = mockExamDeadline(input.startedAt, input.timeLimitMinutes);
  if (!deadline) return false;
  return input.now.getTime() > deadline.getTime() + (input.graceSeconds ?? 0) * 1000;
}

export type MockExamScore = { total: number; answered: number; correct: number; percent: number };

/**
 * Nota do simulado: acertos sobre o TOTAL de questões (questão em branco conta como erro,
 * como numa prova de verdade).
 */
export function scoreMockExam(items: ReadonlyArray<{ answer: string | null; correctAnswer: string }>): MockExamScore {
  const total = items.length;
  const answered = items.filter((item) => item.answer !== null).length;
  const correct = items.filter((item) => item.answer !== null && item.answer === item.correctAnswer).length;
  return { total, answered, correct, percent: total === 0 ? 0 : Math.round((correct / total) * 100) };
}

/**
 * Nome do simulado a partir dos filtros (ex.: "Cesgranrio · Redes, Segurança · 20 questões").
 * Muitos assuntos viram "4 assuntos" para o nome não ficar enorme.
 */
export function buildMockExamTitle(input: { boardName: string | null; subjectNames: string[]; count: number }): string {
  const parts: string[] = [];
  parts.push(input.boardName ?? "Todas as bancas");
  if (input.subjectNames.length === 0) parts.push("Todos os assuntos");
  else if (input.subjectNames.length <= 2) parts.push(input.subjectNames.join(", "));
  else parts.push(`${input.subjectNames.length} assuntos`);
  parts.push(`${input.count} questões`);
  return parts.join(" · ");
}
