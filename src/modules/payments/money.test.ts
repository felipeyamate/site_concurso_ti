/**
 * money.test.ts — Testes de formatação, conversão e parcelas.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  centsToReais,
  formatBRL,
  formatCentsForInput,
  installmentOptions,
  parseBRLInput,
  reaisToCents,
} from "./money";

describe("formatBRL", () => {
  it("formata centavos em reais, no padrão brasileiro", () => {
    expect(formatBRL(9790)).toBe("R$ 97,90");
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatBRL(5)).toBe("R$ 0,05");
  });
});

describe("conversão centavos ↔ reais (formato do Asaas)", () => {
  it("ida e volta sem erro de arredondamento", () => {
    expect(centsToReais(9790)).toBe(97.9);
    expect(reaisToCents(97.9)).toBe(9790);
    // 0.1 + 0.2 = 0.30000000000000004: em centavos, dá 30 exatos.
    expect(reaisToCents(0.1 + 0.2)).toBe(30);
    expect(reaisToCents(1234.56)).toBe(123456);
  });
});

describe("parseBRLInput", () => {
  it("entende os formatos comuns digitados no painel", () => {
    expect(parseBRLInput("97,90")).toBe(9790);
    expect(parseBRLInput("97.90")).toBe(9790);
    expect(parseBRLInput("97,9")).toBe(9790);
    expect(parseBRLInput("97")).toBe(9700);
    expect(parseBRLInput("1.234,56")).toBe(123456);
    expect(parseBRLInput("1,234.56")).toBe(123456);
    expect(parseBRLInput("R$ 1.234,56")).toBe(123456);
    expect(parseBRLInput("1.234")).toBe(123400);
  });

  it("recusa o que não é preço", () => {
    expect(parseBRLInput("")).toBeNull();
    expect(parseBRLInput("abc")).toBeNull();
    expect(parseBRLInput("-10")).toBeNull();
    expect(parseBRLInput("10,5,3")).toBeNull();
  });

  it("formatCentsForInput é o caminho de volta", () => {
    expect(formatCentsForInput(9790)).toBe("97,90");
    expect(parseBRLInput(formatCentsForInput(123456))).toBe(123456);
  });
});

describe("installmentOptions", () => {
  it("oferece de 1x até o máximo, com a parcela arredondada para cima", () => {
    expect(installmentOptions(10000, 3)).toEqual([
      { count: 1, valueCents: 10000 },
      { count: 2, valueCents: 5000 },
      { count: 3, valueCents: 3334 },
    ]);
  });

  it("para quando a parcela ficaria abaixo de R$ 5,00", () => {
    expect(installmentOptions(1200, 12).map((option) => option.count)).toEqual([1, 2]);
  });

  it("sempre oferece à vista, e nunca mais que 12x", () => {
    expect(installmentOptions(300, 12)).toEqual([{ count: 1, valueCents: 300 }]);
    expect(installmentOptions(1_000_000, 30)).toHaveLength(12);
    expect(installmentOptions(10000, 0)).toEqual([{ count: 1, valueCents: 10000 }]);
  });
});
