/**
 * access.test.ts — Testes da regra de acesso às aulas (a regra mais sensível da plataforma).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  canViewCourse,
  checkLessonAccess,
  getEnrollmentStatus,
  isEnrollmentActive,
  type LessonAccessInput,
} from "./access";

const NOW = new Date("2026-09-28T12:00:00Z");
const YESTERDAY = new Date("2026-09-27T12:00:00Z");
const TOMORROW = new Date("2026-09-29T12:00:00Z");

const activeEnrollment = { startsAt: YESTERDAY, expiresAt: null, revokedAt: null };

// Caso base: aluno, curso e aula publicados, aula paga, sem matrícula.
function input(overrides: Partial<LessonAccessInput> = {}): LessonAccessInput {
  return {
    role: "STUDENT",
    isCoursePublished: true,
    isLessonPublished: true,
    isFreePreview: false,
    enrollment: null,
    now: NOW,
    ...overrides,
  };
}

describe("isEnrollmentActive", () => {
  it("vale sem data de fim", () => {
    expect(isEnrollmentActive(activeEnrollment, NOW)).toBe(true);
  });
  it("vale antes da data de fim e deixa de valer nela", () => {
    expect(isEnrollmentActive({ ...activeEnrollment, expiresAt: TOMORROW }, NOW)).toBe(true);
    expect(isEnrollmentActive({ ...activeEnrollment, expiresAt: NOW }, NOW)).toBe(false);
    expect(isEnrollmentActive({ ...activeEnrollment, expiresAt: YESTERDAY }, NOW)).toBe(false);
  });
  it("não vale se revogada ou se ainda não começou", () => {
    expect(isEnrollmentActive({ ...activeEnrollment, revokedAt: YESTERDAY }, NOW)).toBe(false);
    expect(isEnrollmentActive({ ...activeEnrollment, startsAt: TOMORROW }, NOW)).toBe(false);
    expect(isEnrollmentActive(null, NOW)).toBe(false);
  });
});

describe("getEnrollmentStatus", () => {
  it("diz a situação certa em cada caso", () => {
    expect(getEnrollmentStatus(null, NOW)).toBe("NONE");
    expect(getEnrollmentStatus(activeEnrollment, NOW)).toBe("ACTIVE");
    expect(getEnrollmentStatus({ ...activeEnrollment, startsAt: TOMORROW }, NOW)).toBe("NOT_STARTED");
    expect(getEnrollmentStatus({ ...activeEnrollment, expiresAt: YESTERDAY }, NOW)).toBe("EXPIRED");
    // Revogada vence qualquer outra situação.
    expect(getEnrollmentStatus({ ...activeEnrollment, expiresAt: YESTERDAY, revokedAt: YESTERDAY }, NOW)).toBe("REVOKED");
  });
});

describe("checkLessonAccess", () => {
  it("aluno sem matrícula NÃO assiste aula paga", () => {
    expect(checkLessonAccess(input())).toEqual({ allowed: false, reason: "NOT_ENROLLED" });
  });

  it("aluno matriculado assiste", () => {
    expect(checkLessonAccess(input({ enrollment: activeEnrollment }))).toEqual({
      allowed: true,
      reason: "ENROLLED",
    });
  });

  it("aula grátis: qualquer aluno logado assiste, mesmo sem matrícula", () => {
    expect(checkLessonAccess(input({ isFreePreview: true }))).toEqual({
      allowed: true,
      reason: "FREE_PREVIEW",
    });
  });

  it("matrícula vencida ou revogada bloqueia, com o motivo certo", () => {
    expect(checkLessonAccess(input({ enrollment: { ...activeEnrollment, expiresAt: YESTERDAY } }))).toEqual({
      allowed: false,
      reason: "ENROLLMENT_EXPIRED",
    });
    expect(checkLessonAccess(input({ enrollment: { ...activeEnrollment, revokedAt: YESTERDAY } }))).toEqual({
      allowed: false,
      reason: "ENROLLMENT_REVOKED",
    });
  });

  it("matrícula vencida ainda assiste as aulas grátis", () => {
    const expired = { ...activeEnrollment, expiresAt: YESTERDAY };
    expect(checkLessonAccess(input({ enrollment: expired, isFreePreview: true })).allowed).toBe(true);
  });

  it("rascunho (curso ou aula não publicados) bloqueia até matriculados e aulas grátis", () => {
    expect(
      checkLessonAccess(input({ isCoursePublished: false, enrollment: activeEnrollment, isFreePreview: true })),
    ).toEqual({ allowed: false, reason: "NOT_PUBLISHED" });
    expect(checkLessonAccess(input({ isLessonPublished: false, enrollment: activeEnrollment })).allowed).toBe(false);
  });

  it("professor e admin assistem tudo, inclusive rascunhos, sem matrícula", () => {
    for (const role of ["TEACHER", "ADMIN"]) {
      expect(checkLessonAccess(input({ role, isCoursePublished: false, isLessonPublished: false }))).toEqual({
        allowed: true,
        reason: "STAFF",
      });
    }
  });

  it("perfil desconhecido é tratado como aluno comum", () => {
    expect(checkLessonAccess(input({ role: "HACKER" })).allowed).toBe(false);
    expect(checkLessonAccess(input({ role: undefined })).allowed).toBe(false);
  });
});

describe("canViewCourse", () => {
  it("curso publicado: todos; rascunho: só professor/admin", () => {
    expect(canViewCourse(undefined, true)).toBe(true);
    expect(canViewCourse("STUDENT", false)).toBe(false);
    expect(canViewCourse("TEACHER", false)).toBe(true);
  });
});
