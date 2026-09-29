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
  mergeEnrollments,
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

  it("matrícula que ainda não começou bloqueia com motivo próprio (não 'sem matrícula')", () => {
    expect(checkLessonAccess(input({ enrollment: { ...activeEnrollment, startsAt: TOMORROW } }))).toEqual({
      allowed: false,
      reason: "ENROLLMENT_NOT_STARTED",
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

describe("mergeEnrollments (uma matrícula por origem: manual, compra, assinatura)", () => {
  const LAST_WEEK = new Date("2026-09-21T12:00:00Z");
  const NEXT_WEEK = new Date("2026-10-05T12:00:00Z");
  const NEXT_MONTH = new Date("2026-10-28T12:00:00Z");

  it("sem nenhuma: null", () => {
    expect(mergeEnrollments([], NOW)).toBeNull();
  });

  it("basta UMA ativa: vale a que dura mais (sem data de fim ganha)", () => {
    const expired = { startsAt: LAST_WEEK, expiresAt: YESTERDAY, revokedAt: null };
    const shortOne = { startsAt: LAST_WEEK, expiresAt: NEXT_WEEK, revokedAt: null };
    const longOne = { startsAt: LAST_WEEK, expiresAt: NEXT_MONTH, revokedAt: null };
    expect(mergeEnrollments([expired, shortOne, longOne], NOW)).toBe(longOne);
    expect(mergeEnrollments([longOne, activeEnrollment, shortOne], NOW)).toBe(activeEnrollment);
  });

  it("um reembolso (revogada) não apaga o acesso que veio de outra origem", () => {
    const refundedPurchase = { startsAt: LAST_WEEK, expiresAt: NEXT_MONTH, revokedAt: YESTERDAY };
    const subscription = { startsAt: LAST_WEEK, expiresAt: NEXT_WEEK, revokedAt: null };
    const merged = mergeEnrollments([refundedPurchase, subscription], NOW);
    expect(merged).toBe(subscription);
    expect(isEnrollmentActive(merged, NOW)).toBe(true);
  });

  it("nenhuma ativa: prefere a que ainda vai começar (a mais próxima)", () => {
    const expired = { startsAt: LAST_WEEK, expiresAt: YESTERDAY, revokedAt: null };
    const later = { startsAt: NEXT_MONTH, expiresAt: null, revokedAt: null };
    const sooner = { startsAt: NEXT_WEEK, expiresAt: null, revokedAt: null };
    expect(mergeEnrollments([expired, later, sooner], NOW)).toBe(sooner);
  });

  it("todas encerradas: fica a que terminou por último (explica o motivo ao aluno)", () => {
    const expiredLong = { startsAt: LAST_WEEK, expiresAt: LAST_WEEK, revokedAt: null };
    const revokedYesterday = { startsAt: LAST_WEEK, expiresAt: NEXT_MONTH, revokedAt: YESTERDAY };
    expect(getEnrollmentStatus(mergeEnrollments([expiredLong, revokedYesterday], NOW), NOW)).toBe("REVOKED");
    const expiredYesterday = { startsAt: LAST_WEEK, expiresAt: YESTERDAY, revokedAt: null };
    const revokedLong = { startsAt: LAST_WEEK, expiresAt: null, revokedAt: LAST_WEEK };
    expect(getEnrollmentStatus(mergeEnrollments([revokedLong, expiredYesterday], NOW), NOW)).toBe("EXPIRED");
  });
});
