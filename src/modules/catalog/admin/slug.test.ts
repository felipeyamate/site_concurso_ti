/**
 * slug.test.ts — Testes da geração de endereços (slugs) de cursos e aulas.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { findAvailableSlug, isValidSlug, slugify, SLUG_MAX_LENGTH } from "./slug";

describe("slugify", () => {
  it("tira acentos, põe em minúsculas e troca o resto por hífens", () => {
    expect(slugify("Segurança da Informação")).toBe("seguranca-da-informacao");
    expect(slugify("  Excel: fórmulas & funções (2026)!  ")).toBe("excel-formulas-funcoes-2026");
    expect(slugify("Aula 1 — Hardware")).toBe("aula-1-hardware");
  });

  it("nunca devolve vazio e respeita o tamanho máximo", () => {
    expect(slugify("!!!")).toBe("item");
    const long = slugify("palavra ".repeat(40));
    expect(long.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(long.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it("aceita só letras minúsculas sem acento, números e hífens no meio", () => {
    expect(isValidSlug("seguranca-da-informacao")).toBe(true);
    expect(isValidSlug("Seguranca")).toBe(false);
    expect(isValidSlug("segurança")).toBe(false);
    expect(isValidSlug("-inicio")).toBe(false);
    expect(isValidSlug("dois--hifens")).toBe(false);
    expect(isValidSlug("com espaço")).toBe(false);
  });
});

describe("findAvailableSlug", () => {
  it("acrescenta -2, -3... quando o endereço já existe", async () => {
    const taken = new Set(["hardware", "hardware-2"]);
    expect(await findAvailableSlug("Hardware", async (slug) => taken.has(slug))).toBe("hardware-3");
    expect(await findAvailableSlug("Redes", async (slug) => taken.has(slug))).toBe("redes");
  });
});
