/**
 * error-messages.test.ts — Testes da tradução de erros de autenticação.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { getAuthErrorMessage } from "./error-messages";

describe("getAuthErrorMessage", () => {
  it("traduz códigos conhecidos", () => {
    expect(getAuthErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" })).toBe("E-mail ou senha incorretos.");
    expect(getAuthErrorMessage({ code: "INVALID_TOKEN" })).toContain("inválido");
  });

  it("avisa sobre excesso de tentativas (HTTP 429), independente do código", () => {
    expect(getAuthErrorMessage({ status: 429, code: "INVALID_EMAIL_OR_PASSWORD" })).toContain("Muitas tentativas");
  });

  it("usa mensagem genérica para erros desconhecidos, sem vazar detalhes técnicos", () => {
    const message = getAuthErrorMessage({ code: "SOMETHING_WEIRD", message: "stack trace secreto" });
    expect(message).not.toContain("stack trace");
    expect(getAuthErrorMessage(null)).toBe(message);
  });
});
