/**
 * access.test.ts — Quem resolve questões sem limite, a cota grátis diária e os simulados.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  FREE_DAILY_ANSWERS,
  canUseMockExams,
  checkAnswerPermission,
  getQuestionBankLevel,
  remainingFreeAnswers,
  startOfTodayInSaoPaulo,
} from "./access";

describe("getQuestionBankLevel", () => {
  it("professor/admin e aluno com matrícula ativa: acesso completo", () => {
    expect(getQuestionBankLevel({ role: "TEACHER", hasActiveEnrollment: false })).toBe("FULL");
    expect(getQuestionBankLevel({ role: "ADMIN", hasActiveEnrollment: false })).toBe("FULL");
    expect(getQuestionBankLevel({ role: "STUDENT", hasActiveEnrollment: true })).toBe("FULL");
  });

  it("aluno sem matrícula ativa (ou perfil desconhecido): conta gratuita", () => {
    expect(getQuestionBankLevel({ role: "STUDENT", hasActiveEnrollment: false })).toBe("FREE");
    expect(getQuestionBankLevel({ role: "HACKER", hasActiveEnrollment: false })).toBe("FREE");
  });
});

describe("cota grátis", () => {
  it(`conta gratuita responde até ${FREE_DAILY_ANSWERS} por dia; acesso completo, sem limite`, () => {
    expect(checkAnswerPermission("FREE", 0)).toEqual({ allowed: true, remainingFree: FREE_DAILY_ANSWERS - 1 });
    expect(checkAnswerPermission("FREE", FREE_DAILY_ANSWERS - 1)).toEqual({ allowed: true, remainingFree: 0 });
    expect(checkAnswerPermission("FREE", FREE_DAILY_ANSWERS)).toEqual({ allowed: false, reason: "FREE_LIMIT_REACHED" });
    expect(checkAnswerPermission("FULL", 5000)).toEqual({ allowed: true, remainingFree: null });
    expect(remainingFreeAnswers("FREE", 3)).toBe(FREE_DAILY_ANSWERS - 3);
    expect(remainingFreeAnswers("FREE", 99)).toBe(0);
    expect(remainingFreeAnswers("FULL", 3)).toBeNull();
  });

  it("simulados só com acesso completo", () => {
    expect(canUseMockExams("FULL")).toBe(true);
    expect(canUseMockExams("FREE")).toBe(false);
  });

  it("o dia vira à meia-noite de Brasília (não à do servidor em UTC)", () => {
    // 01:30 UTC de 01/10 ainda é 30/09 em Brasília (22:30).
    expect(startOfTodayInSaoPaulo(new Date("2026-10-01T01:30:00Z")).toISOString()).toBe("2026-09-30T03:00:00.000Z");
    expect(startOfTodayInSaoPaulo(new Date("2026-10-01T03:00:00Z")).toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });
});
