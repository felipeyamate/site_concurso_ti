/**
 * consent.test.ts — Testes da escolha de cookies de análise.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { analyticsChoiceCookie, readAnalyticsChoice } from "./consent";

describe("escolha de cookies", () => {
  it("lê a escolha no meio de outros cookies; valor desconhecido ou ausente = ainda não escolheu", () => {
    expect(readAnalyticsChoice("a=1; ct_cookies=analytics; b=2")).toBe("analytics");
    expect(readAnalyticsChoice("ct_cookies=essential")).toBe("essential");
    expect(readAnalyticsChoice("ct_cookies=talvez")).toBeNull();
    expect(readAnalyticsChoice("outro=ct_cookies")).toBeNull();
    expect(readAnalyticsChoice("")).toBeNull();
  });

  it("grava por 1 ano, no site todo; Secure só com HTTPS", () => {
    expect(analyticsChoiceCookie("analytics", true)).toBe("ct_cookies=analytics; Max-Age=31536000; Path=/; SameSite=Lax; Secure");
    expect(analyticsChoiceCookie("essential", false)).toBe("ct_cookies=essential; Max-Age=31536000; Path=/; SameSite=Lax");
  });
});
