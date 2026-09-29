/**
 * cpf.test.ts — Testes da validação de CPF.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { formatCpf, isValidCpf, maskCpf, normalizeCpf } from "./cpf";

// CPFs de exemplo gerados com a regra oficial (não pertencem a ninguém de propósito conhecido).
const VALID = "529.982.247-25";

describe("isValidCpf", () => {
  it("aceita CPF válido com ou sem pontuação", () => {
    expect(isValidCpf(VALID)).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("111.444.777-35")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("529.982.247-15")).toBe(false);
  });

  it("recusa tamanho errado e números repetidos", () => {
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });
});

describe("formatar e esconder", () => {
  it("limpa, formata e mascara", () => {
    expect(normalizeCpf(VALID)).toBe("52998224725");
    expect(formatCpf("52998224725")).toBe(VALID);
    expect(maskCpf("52998224725")).toBe("***.982.247-**");
    expect(maskCpf("123")).toBe("***");
  });
});
