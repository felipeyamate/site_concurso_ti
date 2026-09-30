/**
 * accounts.ts — Ajudantes de conta para os testes E2E: e-mail único, cadastro pela tela e login.
 *
 * Quem chama: os testes de `tests/e2e/`.
 * O cadastro passa pelo formulário de verdade (inclusive a caixa "Li e aceito os Termos"), então
 * cada conta criada aqui já tem o aceite registrado (LGPD), como a de um aluno real.
 */
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "senhaForte123";

/** E-mail que nunca repete (os testes rodam várias vezes no mesmo banco). */
export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@exemplo.com`;
}

/** Cria a conta pelo formulário /cadastro e espera chegar à área do aluno. */
export async function signUp(page: Page, input: { name: string; email: string; password?: string }): Promise<void> {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(input.name);
  await page.getByLabel("E-mail").fill(input.email);
  await page.getByLabel("Senha (mínimo 8 caracteres)").fill(input.password ?? PASSWORD);
  await page.getByLabel("Confirme a senha").fill(input.password ?? PASSWORD);
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL("**/area-do-aluno");
  await expect(page.getByRole("heading", { name: `Olá, ${input.name}!` })).toBeVisible();
}

/** Entra com e-mail e senha pela tela /entrar (voltando para `returnTo`, se informado). */
export async function signIn(page: Page, email: string, returnTo?: string, password: string = PASSWORD): Promise<void> {
  await page.goto(returnTo ? `/entrar?voltar=${encodeURIComponent(returnTo)}` : "/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
