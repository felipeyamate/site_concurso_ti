/**
 * schemas.test.ts — Testes da validação dos formulários do painel de cursos.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { toFieldErrors } from "@/lib/form-state";

import { updateCourseSchema, updateLessonSchema, updateLessonVideoSchema } from "./schemas";

describe("formulário do curso", () => {
  const valid = {
    courseId: "c1",
    title: "  Informática do zero ",
    slug: "Informatica-Do-Zero",
    subtitle: "",
    description: "Descrição",
  };

  it("limpa os textos, converte o slug para minúsculas e a caixa marcada para true", () => {
    const parsed = updateCourseSchema.parse({ ...valid, isPublished: "on" });
    expect(parsed).toMatchObject({
      title: "Informática do zero",
      slug: "informatica-do-zero",
      subtitle: null,
      isPublished: true,
    });
    // Caixa desmarcada: o navegador não manda o campo.
    expect(updateCourseSchema.parse(valid).isPublished).toBe(false);
  });

  it("explica os erros por campo, em português", () => {
    const result = updateCourseSchema.safeParse({ ...valid, title: "ab", slug: "com espaço" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = toFieldErrors(result.error);
      expect(errors.title).toMatch(/pelo menos 3/);
      expect(errors.slug).toMatch(/letras minúsculas/);
    }
  });
});

describe("formulário da aula", () => {
  it("aceita os dados e as caixas de seleção", () => {
    const parsed = updateLessonSchema.parse({
      lessonId: "l1",
      moduleId: "m1",
      title: "Aula de redes",
      slug: "aula-de-redes",
      description: "",
      isFreePreview: "on",
    });
    expect(parsed.isFreePreview).toBe(true);
    expect(parsed.isPublished).toBe(false);
  });
});

describe("formulário do vídeo", () => {
  it("junta minutos e segundos numa duração só", () => {
    const parsed = updateLessonVideoSchema.parse({
      lessonId: "l1",
      source: "PANDA",
      pandaEmbed: "link",
      durationMinutes: "12",
      durationSecondsPart: "34",
    });
    expect(parsed).toEqual({ lessonId: "l1", source: "PANDA", pandaEmbed: "link", durationSeconds: 754 });
  });

  it("campos de duração vazios valem 0; valores inválidos dão erro claro", () => {
    expect(
      updateLessonVideoSchema.parse({ lessonId: "l1", source: "NONE", durationMinutes: "", durationSecondsPart: "" })
        .durationSeconds,
    ).toBe(0);
    const result = updateLessonVideoSchema.safeParse({
      lessonId: "l1",
      source: "NONE",
      durationMinutes: "abc",
      durationSecondsPart: "75",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = toFieldErrors(result.error);
      expect(errors.durationMinutes).toMatch(/número/);
      expect(errors.durationSecondsPart).toMatch(/no máximo 59/);
    }
  });

  it("recusa origem de vídeo desconhecida", () => {
    expect(updateLessonVideoSchema.safeParse({ lessonId: "l1", source: "YOUTUBE" }).success).toBe(false);
  });
});
