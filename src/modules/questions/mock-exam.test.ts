/**
 * mock-exam.test.ts — Sorteio, prazo e nota do simulado.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { buildMockExamTitle, drawMockExamQuestions, isPastDeadline, mockExamDeadline, scoreMockExam, shuffle } from "./mock-exam";

// "Aleatório" previsível para os testes (sempre a mesma sequência).
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe("shuffle", () => {
  it("mantém os mesmos itens (só muda a ordem) e não mexe na lista original", () => {
    const original = ["a", "b", "c", "d", "e"];
    const shuffled = shuffle(original, seededRandom(7));
    expect([...shuffled].sort()).toEqual(original);
    expect(original).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("drawMockExamQuestions", () => {
  const candidates = ["q1", "q2", "q3", "q4", "q5", "q6"];

  it("primeiro as questões ainda não respondidas; completa com as respondidas se faltar", () => {
    const answered = new Set(["q1", "q2", "q3"]);
    const drawn = drawMockExamQuestions({ candidateIds: candidates, answeredIds: answered, count: 4, random: seededRandom(1) });
    expect(drawn).toHaveLength(4);
    expect(new Set(drawn.slice(0, 3))).toEqual(new Set(["q4", "q5", "q6"]));
    expect(answered.has(drawn[3])).toBe(true);
  });

  it("sem questões suficientes: devolve as que houver, sem repetir", () => {
    const drawn = drawMockExamQuestions({ candidateIds: candidates, answeredIds: new Set(), count: 10, random: seededRandom(2) });
    expect(drawn).toHaveLength(6);
    expect(new Set(drawn).size).toBe(6);
  });
});

describe("prazo", () => {
  const startedAt = new Date("2026-09-30T12:00:00Z");

  it("sem limite de tempo nunca esgota", () => {
    expect(mockExamDeadline(startedAt, null)).toBeNull();
    expect(isPastDeadline({ startedAt, timeLimitMinutes: null, now: new Date("2030-01-01T00:00:00Z") })).toBe(false);
  });

  it("com limite: esgota depois do prazo, com tolerância para a última resposta", () => {
    expect(mockExamDeadline(startedAt, 30)?.toISOString()).toBe("2026-09-30T12:30:00.000Z");
    const justAfter = new Date("2026-09-30T12:30:10Z");
    expect(isPastDeadline({ startedAt, timeLimitMinutes: 30, now: justAfter })).toBe(true);
    expect(isPastDeadline({ startedAt, timeLimitMinutes: 30, now: justAfter, graceSeconds: 30 })).toBe(false);
    expect(isPastDeadline({ startedAt, timeLimitMinutes: 30, now: new Date("2026-09-30T12:31:00Z"), graceSeconds: 30 })).toBe(true);
  });
});

describe("scoreMockExam", () => {
  it("acertos sobre o total: em branco conta como erro", () => {
    expect(
      scoreMockExam([
        { answer: "A", correctAnswer: "A" },
        { answer: "C", correctAnswer: "C" },
        { answer: "B", correctAnswer: "D" },
        { answer: null, correctAnswer: "E" },
      ]),
    ).toEqual({ total: 4, answered: 3, correct: 2, percent: 50 });
    expect(scoreMockExam([])).toEqual({ total: 0, answered: 0, correct: 0, percent: 0 });
  });
});

describe("buildMockExamTitle", () => {
  it("descreve os filtros de forma curta", () => {
    expect(buildMockExamTitle({ boardName: "Cesgranrio", subjectNames: ["Redes"], count: 20 })).toBe("Cesgranrio · Redes · 20 questões");
    expect(buildMockExamTitle({ boardName: null, subjectNames: [], count: 10 })).toBe("Todas as bancas · Todos os assuntos · 10 questões");
    expect(buildMockExamTitle({ boardName: null, subjectNames: ["A", "B", "C"], count: 30 })).toBe("Todas as bancas · 3 assuntos · 30 questões");
  });
});
