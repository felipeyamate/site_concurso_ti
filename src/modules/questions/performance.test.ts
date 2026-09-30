/**
 * performance.test.ts — Desempenho por assunto e pontos fracos.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { accuracyPercent, overallTotals, summarizeBySubject } from "./performance";

const row = (name: string, attempts: number, correct: number) => ({ subjectId: name, name, slug: name.toLowerCase(), attempts, correct });

describe("accuracyPercent", () => {
  it("arredonda e trata o zero", () => {
    expect(accuracyPercent(2, 3)).toBe(67);
    expect(accuracyPercent(0, 0)).toBe(0);
  });
});

describe("summarizeBySubject", () => {
  it("pontos fracos primeiro (pior primeiro); poucos dados não viram ponto fraco", () => {
    const summary = summarizeBySubject([
      row("Redes", 20, 18), // 90%
      row("Segurança", 10, 3), // 30% — fraco
      row("Office", 8, 4), // 50% — fraco
      row("Linux", 2, 0), // 0%, mas só 2 respostas: ainda não é "ponto fraco"
    ]);
    expect(summary.map((item) => [item.name, item.percent, item.isWeak])).toEqual([
      ["Segurança", 30, true],
      ["Office", 50, true],
      ["Redes", 90, false],
      ["Linux", 0, false],
    ]);
  });

  it("totais gerais", () => {
    expect(overallTotals([row("A", 10, 7), row("B", 10, 3)])).toEqual({ attempts: 20, correct: 10, percent: 50 });
  });
});
