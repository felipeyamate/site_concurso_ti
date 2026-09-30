/**
 * consent.test.ts — Testes da escolha de cookies de análise.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { analyticsChoiceCookie, readAnalyticsChoice, sanitizeAnalyticsEvent, stripUrlQuery } from "./consent";

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

describe("eventos do PostHog sem segredos no endereço", () => {
  it("tira ?parâmetros e #... só de endereços http(s)", () => {
    expect(stripUrlQuery("https://site.com.br/redefinir-senha?token=abc")).toBe("https://site.com.br/redefinir-senha");
    expect(stripUrlQuery("http://localhost:3000/aula#t=30")).toBe("http://localhost:3000/aula");
    expect(stripUrlQuery("https://site.com.br/cursos")).toBe("https://site.com.br/cursos");
    expect(stripUrlQuery("/redefinir-senha")).toBe("/redefinir-senha");
    expect(stripUrlQuery("Chrome")).toBe("Chrome");
  });

  it("limpa a página atual, o referrer e as propriedades de pessoa (inclusive as da primeira visita)", () => {
    const event = sanitizeAnalyticsEvent({
      event: "$pageview",
      properties: { $current_url: "https://site.com.br/redefinir-senha?token=segredo", $referrer: "https://google.com/?q=x", $pathname: "/redefinir-senha", count: 1 },
      $set_once: { $initial_current_url: "https://site.com.br/r/parceira?para=/cursos" },
    });
    expect(event?.properties).toEqual({ $current_url: "https://site.com.br/redefinir-senha", $referrer: "https://google.com/", $pathname: "/redefinir-senha", count: 1 });
    expect(event?.$set_once).toEqual({ $initial_current_url: "https://site.com.br/r/parceira" });
    expect(JSON.stringify(event)).not.toContain("segredo");
    expect(sanitizeAnalyticsEvent(null)).toBeNull();
  });
});
