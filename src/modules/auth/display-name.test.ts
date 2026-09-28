/**
 * display-name.test.ts — Testes do nome provisório gerado a partir do e-mail.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { nameFromEmail } from "./display-name";

describe("nameFromEmail", () => {
  it.each([
    ["maria.silva@gmail.com", "Maria Silva"],
    ["JOAO_PEREIRA-92@exemplo.com", "Joao Pereira 92"],
    ["ana+cursos@exemplo.com", "Ana Cursos"],
    ["x@exemplo.com", "X"],
  ])("%s → %s", (email, expected) => {
    expect(nameFromEmail(email)).toBe(expected);
  });

  it("usa um nome padrão quando não sobra nada aproveitável", () => {
    expect(nameFromEmail("...@exemplo.com")).toBe("Aluno");
    expect(nameFromEmail("")).toBe("Aluno");
  });
});
