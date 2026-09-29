/**
 * curriculum.test.ts — Testes da ordem das aulas, navegação e filtro de rascunhos.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  findAdjacentLessons,
  flattenLessons,
  totalDurationSeconds,
  visibleCurriculum,
  type CourseCurriculum,
  type CurriculumLesson,
} from "./curriculum";

function lesson(id: string, position: number, overrides: Partial<CurriculumLesson> = {}): CurriculumLesson {
  return {
    id,
    slug: id,
    title: id,
    description: "",
    position,
    durationSeconds: 60,
    isFreePreview: false,
    isPublished: true,
    ...overrides,
  };
}

// Módulos e aulas propositalmente fora de ordem, para testar a ordenação.
const curriculum: CourseCurriculum = {
  id: "c1",
  slug: "curso",
  title: "Curso",
  subtitle: null,
  description: "",
  isPublished: true,
  modules: [
    { id: "m2", title: "Módulo 2", position: 2, lessons: [lesson("m2-a2", 2), lesson("m2-a1", 1)] },
    {
      id: "m1",
      title: "Módulo 1",
      position: 1,
      lessons: [lesson("m1-a1", 1), lesson("m1-rascunho", 2, { isPublished: false })],
    },
    { id: "m3", title: "Só rascunhos", position: 3, lessons: [lesson("m3-a1", 1, { isPublished: false })] },
  ],
};

describe("flattenLessons", () => {
  it("segue a ordem de módulos e depois de aulas", () => {
    expect(flattenLessons(curriculum).map((item) => item.id)).toEqual([
      "m1-a1",
      "m1-rascunho",
      "m2-a1",
      "m2-a2",
      "m3-a1",
    ]);
  });
});

describe("visibleCurriculum", () => {
  it("esconde aulas não publicadas e módulos que ficam vazios", () => {
    const visible = visibleCurriculum(curriculum, { includeDrafts: false });
    expect(flattenLessons(visible).map((item) => item.id)).toEqual(["m1-a1", "m2-a1", "m2-a2"]);
    expect(visible.modules.map((item) => item.id)).not.toContain("m3");
  });

  it("professor/admin vê tudo", () => {
    expect(visibleCurriculum(curriculum, { includeDrafts: true })).toBe(curriculum);
  });
});

describe("findAdjacentLessons", () => {
  const ordered = flattenLessons(visibleCurriculum(curriculum, { includeDrafts: false }));

  it("acha a anterior e a próxima, atravessando módulos", () => {
    const { previous, next } = findAdjacentLessons(ordered, "m2-a1");
    expect(previous?.id).toBe("m1-a1");
    expect(next?.id).toBe("m2-a2");
  });

  it("primeira aula não tem anterior; última não tem próxima; aula desconhecida não tem nenhuma", () => {
    expect(findAdjacentLessons(ordered, "m1-a1").previous).toBeNull();
    expect(findAdjacentLessons(ordered, "m2-a2").next).toBeNull();
    expect(findAdjacentLessons(ordered, "nao-existe")).toEqual({ previous: null, next: null });
  });
});

describe("totalDurationSeconds", () => {
  it("soma as durações", () => {
    expect(totalDurationSeconds([lesson("a", 1), lesson("b", 2, { durationSeconds: 90 })])).toBe(150);
  });
});
