/**
 * request-metadata.test.ts — Testes da leitura de IP e navegador (prova do aceite e registro de acesso).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { limitRequestMetadata, requestMetadata } from "./request-metadata";

describe("IP e navegador da requisição", () => {
  it("usa o primeiro IP do x-forwarded-for (o visitante); sem ele, o x-real-ip", () => {
    expect(requestMetadata(new Headers({ "x-forwarded-for": "200.1.2.3, 10.0.0.1", "user-agent": "Firefox" }))).toEqual({
      ipAddress: "200.1.2.3",
      userAgent: "Firefox",
    });
    expect(requestMetadata(new Headers({ "x-real-ip": "200.9.9.9" }))).toEqual({ ipAddress: "200.9.9.9", userAgent: null });
    expect(requestMetadata(new Headers())).toEqual({ ipAddress: null, userAgent: null });
  });

  it("corta textos gigantes e troca vazio por null", () => {
    const limited = limitRequestMetadata({ ipAddress: "1".repeat(300), userAgent: "A".repeat(2000) });
    expect(limited.ipAddress).toHaveLength(100);
    expect(limited.userAgent).toHaveLength(500);
    expect(limitRequestMetadata({ ipAddress: "", userAgent: "" })).toEqual({ ipAddress: null, userAgent: null });
  });
});
