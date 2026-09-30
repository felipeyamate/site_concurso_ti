/**
 * answers.test.ts — Letras válidas, correção e montagem de uma questão.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { answerLabel, choicesFor, isCorrectAnswer, isValidAnswer, validateQuestionContent } from "./answers";

const options = (labels: string[]) => labels.map((label) => ({ label, text: `Alternativa ${label}` }));

describe("isValidAnswer", () => {
  it("múltipla escolha: só as letras que a questão tem", () => {
    expect(isValidAnswer("MULTIPLE_CHOICE", "D", ["A", "B", "C", "D"])).toBe(true);
    expect(isValidAnswer("MULTIPLE_CHOICE", "E", ["A", "B", "C", "D"])).toBe(false);
  });

  it("Certo/Errado: só C ou E", () => {
    expect(isValidAnswer("TRUE_FALSE", "C", [])).toBe(true);
    expect(isValidAnswer("TRUE_FALSE", "E", [])).toBe(true);
    expect(isValidAnswer("TRUE_FALSE", "A", [])).toBe(false);
  });
});

describe("correção e rótulos", () => {
  it("confere a letra exata e mostra Certo/Errado por extenso", () => {
    expect(isCorrectAnswer("B", "B")).toBe(true);
    expect(isCorrectAnswer("B", "C")).toBe(false);
    expect(answerLabel("TRUE_FALSE", "C")).toBe("Certo");
    expect(answerLabel("TRUE_FALSE", "E")).toBe("Errado");
    expect(answerLabel("MULTIPLE_CHOICE", "E")).toBe("E");
  });
});

describe("validateQuestionContent", () => {
  it("aceita múltipla escolha de 2 a 5 alternativas em sequência, com o gabarito entre elas", () => {
    expect(validateQuestionContent({ type: "MULTIPLE_CHOICE", options: options(["A", "B"]), correctAnswer: "B" })).toEqual([]);
    expect(validateQuestionContent({ type: "MULTIPLE_CHOICE", options: options(["A", "B", "C", "D", "E"]), correctAnswer: "E" })).toEqual(
      [],
    );
  });

  it("recusa: poucas alternativas, letra pulada, alternativa vazia e gabarito fora", () => {
    expect(validateQuestionContent({ type: "MULTIPLE_CHOICE", options: options(["A"]), correctAnswer: "A" })).toContain(
      "A questão precisa ter de 2 a 5 alternativas.",
    );
    expect(validateQuestionContent({ type: "MULTIPLE_CHOICE", options: options(["A", "C"]), correctAnswer: "A" })).toContain(
      "As alternativas devem seguir a ordem A, B, C... sem pular letras.",
    );
    expect(
      validateQuestionContent({ type: "MULTIPLE_CHOICE", options: [{ label: "A", text: "x" }, { label: "B", text: " " }], correctAnswer: "A" }),
    ).toContain("Alternativa B sem texto (as alternativas seguem a ordem A, B, C... sem pular).");
    expect(validateQuestionContent({ type: "MULTIPLE_CHOICE", options: options(["A", "B", "C"]), correctAnswer: "D" })).toContain(
      "O gabarito precisa ser uma das alternativas.",
    );
  });

  it("Certo/Errado: sem alternativas e gabarito C ou E", () => {
    expect(validateQuestionContent({ type: "TRUE_FALSE", options: [], correctAnswer: "E" })).toEqual([]);
    expect(validateQuestionContent({ type: "TRUE_FALSE", options: options(["A", "B"]), correctAnswer: "C" })).toContain(
      "Questão de Certo/Errado não tem alternativas.",
    );
    expect(validateQuestionContent({ type: "TRUE_FALSE", options: [], correctAnswer: "A" })).toHaveLength(1);
  });
});

describe("choicesFor", () => {
  it("múltipla escolha: as alternativas da questão, na ordem recebida", () => {
    expect(choicesFor("MULTIPLE_CHOICE", options(["A", "B"]))).toEqual([
      { value: "A", label: "A", text: "Alternativa A" },
      { value: "B", label: "B", text: "Alternativa B" },
    ]);
  });

  it("Certo/Errado: sempre as duas opções por extenso, sem texto", () => {
    expect(choicesFor("TRUE_FALSE", [])).toEqual([
      { value: "C", label: "Certo", text: null },
      { value: "E", label: "Errado", text: null },
    ]);
  });
});
