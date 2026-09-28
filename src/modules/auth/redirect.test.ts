/**
 * redirect.test.ts — Testes da proteção contra "open redirect" no pós-login.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_AFTER_LOGIN_PATH, safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeRedirectPath("/admin")).toBe("/admin");
    expect(safeRedirectPath("/area-do-aluno?aba=cursos")).toBe("/area-do-aluno?aba=cursos");
  });

  it("recusa endereços de outros sites", () => {
    expect(safeRedirectPath("https://site-falso.com")).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath("//site-falso.com")).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath("/\\site-falso.com")).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath("javascript:alert(1)")).toBe(DEFAULT_AFTER_LOGIN_PATH);
  });

  it("recusa caracteres de controle (truques com quebra de linha/tab)", () => {
    expect(safeRedirectPath("/\t/site-falso.com")).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath("/ok\nLocation: x")).toBe(DEFAULT_AFTER_LOGIN_PATH);
  });

  it("usa o padrão quando não há valor ou o tipo é inesperado", () => {
    expect(safeRedirectPath(undefined)).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath("")).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath(["/admin", "/outro"])).toBe(DEFAULT_AFTER_LOGIN_PATH);
    expect(safeRedirectPath(undefined, "/")).toBe("/");
  });
});
