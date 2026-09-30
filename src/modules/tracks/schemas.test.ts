/**
 * schemas.test.ts — Testes da validação dos formulários de trilha.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { practiceItemSchema, sectionSchema, trackSchema, updateItemSchema } from "./schemas";

describe("formulário da trilha", () => {
  it("aceita o mínimo; vazio vira null; caixas marcadas viram true", () => {
    const parsed = trackSchema.parse({ title: "TI para o BB — Cesgranrio", slug: "", summary: "", body: "", boardId: "", isPublished: "on", fromIncidence: "on" });
    expect(parsed).toMatchObject({ trackId: null, slug: null, boardId: null, productId: null, planId: null, isPublished: true, fromIncidence: true });
  });

  it("recusa título curto e endereço com acento/maiúscula de verdade", () => {
    expect(trackSchema.safeParse({ title: "TI", summary: "", body: "" }).success).toBe(false);
    expect(trackSchema.safeParse({ title: "Trilha boa", slug: "trilha-ção", summary: "", body: "" }).success).toBe(false);
    // Maiúsculas viram minúsculas (como nos cursos).
    expect(trackSchema.parse({ title: "Trilha boa", slug: "Trilha-BB", summary: "", body: "" }).slug).toBe("trilha-bb");
  });
});

describe("etapas e passos", () => {
  it("etapa precisa de nome; o assunto é opcional", () => {
    expect(sectionSchema.safeParse({ trackId: "t", title: "", description: "" }).success).toBe(false);
    expect(sectionSchema.parse({ trackId: "t", title: "Segurança", description: "", subjectId: "" }).subjectId).toBeNull();
  });

  it("treino: meta de 1 a 200 questões, inteira", () => {
    const base = { sectionId: "s", subjectId: "a", boardId: "", note: "" };
    expect(practiceItemSchema.parse({ ...base, questionGoal: "15" })).toMatchObject({ questionGoal: 15, boardId: null });
    for (const bad of ["0", "201", "2.5", "abc"]) expect(practiceItemSchema.safeParse({ ...base, questionGoal: bad }).success).toBe(false);
    expect(practiceItemSchema.safeParse({ ...base, subjectId: "", questionGoal: "10" }).success).toBe(false);
  });

  it("editar passo: a meta é opcional (aula não tem meta)", () => {
    const parsed = updateItemSchema.parse({ itemId: "i", sectionId: "s", note: "Dica" });
    expect(parsed.questionGoal).toBeUndefined();
    expect(parsed.boardId).toBeNull();
  });
});
