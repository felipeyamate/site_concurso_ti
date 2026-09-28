/**
 * renewal.test.ts — Testes da regra de criar/renovar matrícula.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { computeEnrollmentRenewal } from "./renewal";

const NOW = new Date("2026-09-28T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe("computeEnrollmentRenewal", () => {
  it("matrícula nova: começa agora e vale N dias (ou sem data de fim)", () => {
    expect(computeEnrollmentRenewal(null, { days: 365, now: NOW })).toEqual({ startsAt: NOW, expiresAt: day(365) });
    expect(computeEnrollmentRenewal(null, { days: null, now: NOW })).toEqual({ startsAt: NOW, expiresAt: null });
  });

  it("renovar matrícula ativa SOMA os dias ao que faltava e mantém o início", () => {
    const active = { startsAt: day(-335), expiresAt: day(30), revokedAt: null };
    expect(computeEnrollmentRenewal(active, { days: 365, now: NOW })).toEqual({
      startsAt: day(-335),
      expiresAt: day(395),
    });
  });

  it("renovar com dias NÃO encurta uma matrícula sem data de fim", () => {
    const permanent = { startsAt: day(-10), expiresAt: null, revokedAt: null };
    expect(computeEnrollmentRenewal(permanent, { days: 30, now: NOW })).toEqual({ startsAt: day(-10), expiresAt: null });
  });

  it("vencida ou revogada: recomeça agora", () => {
    const expired = { startsAt: day(-400), expiresAt: day(-35), revokedAt: null };
    expect(computeEnrollmentRenewal(expired, { days: 365, now: NOW })).toEqual({ startsAt: NOW, expiresAt: day(365) });
    const revoked = { startsAt: day(-10), expiresAt: day(300), revokedAt: day(-1) };
    expect(computeEnrollmentRenewal(revoked, { days: 30, now: NOW })).toEqual({ startsAt: NOW, expiresAt: day(30) });
  });
});
