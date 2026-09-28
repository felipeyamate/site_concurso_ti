/**
 * roles.test.ts — Testes da regra de perfis (quem pode o quê).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { Role as PrismaRole } from "@/generated/prisma/enums";

import { ROLES, hasMinimumRole, isRole } from "./roles";

describe("hasMinimumRole", () => {
  it("libera quando o perfil é igual ao exigido", () => {
    expect(hasMinimumRole("STUDENT", "STUDENT")).toBe(true);
    expect(hasMinimumRole("TEACHER", "TEACHER")).toBe(true);
    expect(hasMinimumRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("libera quando o perfil é maior que o exigido", () => {
    expect(hasMinimumRole("ADMIN", "TEACHER")).toBe(true);
    expect(hasMinimumRole("ADMIN", "STUDENT")).toBe(true);
    expect(hasMinimumRole("TEACHER", "STUDENT")).toBe(true);
  });

  it("nega quando o perfil é menor que o exigido", () => {
    expect(hasMinimumRole("STUDENT", "TEACHER")).toBe(false);
    expect(hasMinimumRole("STUDENT", "ADMIN")).toBe(false);
    expect(hasMinimumRole("TEACHER", "ADMIN")).toBe(false);
  });

  it("nega perfis desconhecidos ou vazios (na dúvida, não libera)", () => {
    expect(hasMinimumRole(undefined, "STUDENT")).toBe(false);
    expect(hasMinimumRole(null, "STUDENT")).toBe(false);
    expect(hasMinimumRole("", "STUDENT")).toBe(false);
    expect(hasMinimumRole("admin", "STUDENT")).toBe(false); // minúsculo não vale
    expect(hasMinimumRole("SUPERUSER", "STUDENT")).toBe(false);
  });
});

describe("isRole", () => {
  it("reconhece só os perfis válidos", () => {
    expect(isRole("ADMIN")).toBe(true);
    expect(isRole("teacher")).toBe(false);
    expect(isRole(42)).toBe(false);
  });
});

describe("ROLES", () => {
  it("é igual ao enum Role do banco (prisma/schema.prisma)", () => {
    expect([...ROLES].sort()).toEqual(Object.values(PrismaRole).sort());
  });
});
