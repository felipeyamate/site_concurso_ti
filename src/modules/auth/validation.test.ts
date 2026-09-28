/**
 * validation.test.ts — Testes das regras dos formulários de autenticação.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { getFieldErrors, signInSchema, signUpSchema } from "./validation";

const validSignUp = {
  name: "Maria",
  email: "Maria@Exemplo.com ",
  password: "senhaForte123",
  confirmPassword: "senhaForte123",
};

describe("signUpSchema", () => {
  it("aceita dados válidos e normaliza o e-mail (minúsculo, sem espaços)", () => {
    const result = signUpSchema.safeParse(validSignUp);
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("maria@exemplo.com");
  });

  it("recusa senha curta", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: "123", confirmPassword: "123" });
    expect(result.success).toBe(false);
    expect(getFieldErrors(result.error!).password).toContain("8 caracteres");
  });

  it("recusa confirmação diferente da senha", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, confirmPassword: "outraSenha123" });
    expect(result.success).toBe(false);
    expect(getFieldErrors(result.error!).confirmPassword).toBe("As senhas não são iguais.");
  });

  it("recusa e-mail inválido e nome vazio, mostrando um erro por campo", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, name: " ", email: "nao-e-email" });
    expect(result.success).toBe(false);
    const errors = getFieldErrors(result.error!);
    expect(errors.name).toBe("Informe seu nome.");
    expect(errors.email).toBe("Informe um e-mail válido.");
  });
});

describe("signInSchema", () => {
  it("exige a senha preenchida", () => {
    const result = signInSchema.safeParse({ email: "a@b.com", password: "" });
    expect(result.success).toBe(false);
    expect(getFieldErrors(result.error!).password).toBe("Informe sua senha.");
  });
});
