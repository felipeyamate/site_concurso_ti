/**
 * course-view.test.ts — Testes da visão do curso para cada tipo de pessoa.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import type { CourseCurriculum, CurriculumLesson } from "@/modules/catalog/curriculum";

import { buildCourseView, type ProgressSnapshot } from "./course-view";

const NOW = new Date("2026-09-28T12:00:00Z");
const EARLIER = new Date("2026-09-20T12:00:00Z");

function lesson(id: string, position: number, overrides: Partial<CurriculumLesson> = {}): CurriculumLesson {
  return {
    id,
    slug: id,
    title: id,
    description: "",
    position,
    durationSeconds: 600,
    isFreePreview: false,
    isPublished: true,
    ...overrides,
  };
}

const curriculum: CourseCurriculum = {
  id: "c1",
  slug: "curso",
  title: "Curso",
  subtitle: null,
  description: "",
  isPublished: true,
  modules: [
    {
      id: "m1",
      title: "M1",
      position: 1,
      lessons: [lesson("gratis", 1, { isFreePreview: true }), lesson("paga", 2), lesson("rascunho", 3, { isPublished: false })],
    },
    { id: "m2", title: "M2", position: 2, lessons: [lesson("final", 1)] },
  ],
};

const activeEnrollment = { startsAt: EARLIER, expiresAt: null, revokedAt: null };

function progress(lessonId: string, completed: boolean, minutesAgo: number): ProgressSnapshot {
  return {
    lessonId,
    positionSeconds: 120,
    durationSeconds: 600,
    completedAt: completed ? EARLIER : null,
    lastWatchedAt: new Date(NOW.getTime() - minutesAgo * 60_000),
  };
}

describe("buildCourseView", () => {
  it("visitante sem login: vê as aulas publicadas; só a grátis aparece liberada", () => {
    const view = buildCourseView({ curriculum, role: undefined, enrollment: null, progress: [], now: NOW });
    expect(view.orderedLessons.map((item) => item.id)).toEqual(["gratis", "paga", "final"]);
    expect(view.lessonStates.gratis.accessible).toBe(true);
    expect(view.lessonStates.paga.accessible).toBe(false);
    expect(view.hasCourseAccess).toBe(false);
    expect(view.enrollmentStatus).toBe("NONE");
    expect(view.firstFreeLesson?.id).toBe("gratis");
  });

  it("aluno matriculado: tudo liberado, progresso e 'continuar' calculados", () => {
    const view = buildCourseView({
      curriculum,
      role: "STUDENT",
      enrollment: activeEnrollment,
      progress: [progress("gratis", true, 30), progress("paga", false, 5), progress("de-outro-curso", true, 1)],
      now: NOW,
    });
    expect(view.hasCourseAccess).toBe(true);
    expect(Object.values(view.lessonStates).every((state) => state.accessible)).toBe(true);
    expect(view.summary).toEqual({ completed: 1, total: 3, percent: 33 });
    expect(view.resumeLesson?.id).toBe("paga");
    expect(view.lessonStates.gratis.completed).toBe(true);
    expect(view.progressByLesson.has("de-outro-curso")).toBe(false);
  });

  it("professor: vê rascunhos e tem acesso a tudo sem matrícula", () => {
    const view = buildCourseView({ curriculum, role: "TEACHER", enrollment: null, progress: [], now: NOW });
    expect(view.orderedLessons.map((item) => item.id)).toContain("rascunho");
    expect(view.hasCourseAccess).toBe(true);
    expect(view.lessonStates.rascunho.accessible).toBe(true);
  });

  it("matrícula vencida: perde o acesso às pagas, mantém o progresso e a aula grátis", () => {
    const expired = { ...activeEnrollment, expiresAt: EARLIER };
    const view = buildCourseView({
      curriculum,
      role: "STUDENT",
      enrollment: expired,
      progress: [progress("paga", true, 10)],
      now: NOW,
    });
    expect(view.hasCourseAccess).toBe(false);
    expect(view.enrollmentStatus).toBe("EXPIRED");
    expect(view.accessByLesson.paga).toEqual({ allowed: false, reason: "ENROLLMENT_EXPIRED" });
    expect(view.lessonStates.paga.completed).toBe(true);
    expect(view.lessonStates.gratis.accessible).toBe(true);
  });
});
