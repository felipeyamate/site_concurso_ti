/**
 * schemas.test.ts — Formulário da questão (alternativas + gabarito) e filtros da URL.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { createMockExamSchema, parsePracticeFilters, practiceFiltersToQuery, questionSchema } from "./schemas";

const baseQuestion = {
  code: "",
  statement: "Qual protocolo usa a porta 443?",
  optionC: "",
  optionD: "",
  optionE: "",
  explanation: "HTTPS usa a porta 443.",
  subjectId: "s1",
  examId: "",
  boardId: "",
};

describe("questionSchema", () => {
  it("múltipla escolha: alternativas até a última preenchida; gabarito em maiúscula", () => {
    const parsed = questionSchema.parse({
      ...baseQuestion,
      type: "MULTIPLE_CHOICE",
      optionA: "HTTP",
      optionB: "HTTPS",
      optionC: "FTP",
      correctAnswer: "b",
      isPublished: "on",
    });
    expect(parsed).toMatchObject({
      type: "MULTIPLE_CHOICE",
      correctAnswer: "B",
      code: null,
      examId: null,
      isPublished: true,
      options: [
        { label: "A", text: "HTTP" },
        { label: "B", text: "HTTPS" },
        { label: "C", text: "FTP" },
      ],
    });
  });

  it("recusa gabarito fora das alternativas e Certo/Errado com alternativas preenchidas", () => {
    const wrongKey = questionSchema.safeParse({ ...baseQuestion, type: "MULTIPLE_CHOICE", optionA: "x", optionB: "y", correctAnswer: "D" });
    expect(wrongKey.success).toBe(false);
    const trueFalse = questionSchema.safeParse({ ...baseQuestion, type: "TRUE_FALSE", optionA: "sobrou", optionB: "", correctAnswer: "C" });
    expect(trueFalse.success).toBe(false);
    const ok = questionSchema.safeParse({ ...baseQuestion, type: "TRUE_FALSE", optionA: "", optionB: "", correctAnswer: "e" });
    expect(ok.success && ok.data.options).toEqual([]);
  });
});

describe("createMockExamSchema", () => {
  it("só quantidades e tempos oferecidos", () => {
    expect(createMockExamSchema.parse({ boardId: "", subjectIds: [], count: "20", timeLimitMinutes: "" })).toEqual({
      boardId: null,
      subjectIds: [],
      count: 20,
      timeLimitMinutes: null,
    });
    expect(createMockExamSchema.safeParse({ boardId: "", subjectIds: [], count: "7", timeLimitMinutes: "" }).success).toBe(false);
    expect(createMockExamSchema.safeParse({ boardId: "", subjectIds: [], count: "10", timeLimitMinutes: "45" }).success).toBe(false);
  });
});

describe("filtros da URL", () => {
  it("lê os válidos e ignora os estranhos (a URL pode ser digitada)", () => {
    expect(
      parsePracticeFilters({ assunto: "redes", banca: "Cesgranrio!", tipo: "certo-errado", situacao: "erradas", pagina: "3" }),
    ).toEqual({ subject: "redes", board: null, exam: null, type: "TRUE_FALSE", status: "erradas", page: 3 });
    expect(parsePracticeFilters({ situacao: "xyz", pagina: "-1" })).toMatchObject({ status: "todas", page: 1, type: null });
  });

  it("volta para a URL (sem os valores padrão)", () => {
    const filters = { subject: "redes", board: null, exam: null, type: "MULTIPLE_CHOICE" as const, status: "todas" as const };
    expect(practiceFiltersToQuery(filters, 2)).toBe("?assunto=redes&tipo=multipla-escolha&pagina=2");
    expect(practiceFiltersToQuery({ ...filters, subject: null, type: null })).toBe("");
  });
});
