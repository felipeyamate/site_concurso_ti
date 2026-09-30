/**
 * conta-e-privacidade.spec.ts — E2E da conta e da LGPD (Fase 7), no navegador:
 * cadastro com aceite dos termos, tela de aceite quando a versão muda, "Baixar meus dados" e
 * "Excluir minha conta" (com a saída e o e-mail liberado para um novo cadastro).
 *
 * Rodar: npm run test:e2e   (sobe o site sozinho; ver playwright.config.ts)
 */
import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { PASSWORD, signIn, signUp, uniqueEmail } from "./helpers/accounts";
import { sql } from "./helpers/db";

test("cadastro: sem marcar o aceite dos termos não cria a conta; marcando, o aceite fica registrado", async ({ page }) => {
  const email = uniqueEmail("e2e-cadastro");
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Aluna Termos");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha (mínimo 8 caracteres)").fill(PASSWORD);
  await page.getByLabel("Confirme a senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Para criar a conta, aceite os Termos de uso e a Política de privacidade.")).toBeVisible();
  expect(await sql(`SELECT id FROM users WHERE email = $1`, [email])).toHaveLength(0);

  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL("**/area-do-aluno");

  await page.getByRole("link", { name: "Minha conta e privacidade" }).click();
  await expect(page.getByText("Você já aceitou esta versão.")).toBeVisible();
  await expect(page.getByText(/no cadastro\)/)).toBeVisible();
  const consents = await sql<{ source: string; user_agent: string | null }>(
    `SELECT c.source, c.user_agent FROM legal_consents c JOIN users u ON u.id = c.user_id WHERE u.email = $1`,
    [email],
  );
  expect(consents).toHaveLength(1);
  expect(consents[0].source).toBe("SIGN_UP");
  expect(consents[0].user_agent).toContain("Chrome");
});

test("textos novos: a área logada pede o aceite antes e depois volta para onde a pessoa ia", async ({ page }) => {
  const email = uniqueEmail("e2e-aceite");
  await signUp(page, { name: "Aluno Aceite", email });
  // Simula que ele tinha aceitado uma versão antiga dos textos.
  await sql(`UPDATE users SET legal_version = '2020-01-01' WHERE email = $1`, [email]);

  // "Minhas compras" abre mesmo sem o aceite (cancelar e pedir reembolso são direitos de quem já comprou).
  await page.goto("/area-do-aluno/compras");
  await expect(page.getByRole("heading", { level: 1, name: "Minhas compras" })).toBeVisible();

  await page.goto("/area-do-aluno/desempenho");
  await page.waitForURL(/\/aceitar-termos\?voltar=%2Farea-do-aluno%2Fdesempenho/);
  await expect(page.getByText(/Atualizamos os Termos de uso e a Política de privacidade/)).toBeVisible();
  await page.getByRole("button", { name: "Aceitar e continuar" }).click();
  await expect(page.getByText("Marque para continuar.")).toBeVisible();

  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Aceitar e continuar" }).click();
  await page.waitForURL("**/area-do-aluno/desempenho");
  const consents = await sql(`SELECT c.source FROM legal_consents c JOIN users u ON u.id = c.user_id WHERE u.email = $1 ORDER BY c.accepted_at`, [
    email,
  ]);
  expect(consents.map((row) => row.source)).toEqual(["SIGN_UP", "REVIEW"]);
});

test("baixar meus dados: um arquivo JSON com a conta, o aceite e o registro de acesso", async ({ page }) => {
  const email = uniqueEmail("e2e-dados");
  await signUp(page, { name: "Aluna Dados", email });
  await page.goto("/area-do-aluno/conta");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Baixar meus dados" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^meus-dados-concurso-ti-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(data.conta.email).toBe(email);
  expect(data.aceitesDosTermosEPrivacidade).toHaveLength(1);
  // O login do cadastro ficou no registro de acesso (Marco Civil).
  expect(data.registrosDeAcesso.length).toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(data)).not.toContain(PASSWORD);
});

test("excluir a conta: pede a frase, sai do site, o login antigo deixa de valer e o e-mail fica livre", async ({ page }) => {
  const email = uniqueEmail("e2e-excluir");
  await signUp(page, { name: "Aluno Excluir", email });
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/area-do-aluno/conta");

  await page.getByLabel(/Para confirmar, digite/).fill("excluir");
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await expect(page.getByText("Para confirmar, digite exatamente: EXCLUIR MINHA CONTA")).toBeVisible();

  await page.getByLabel(/Para confirmar, digite/).fill("EXCLUIR MINHA CONTA");
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await page.waitForURL("**/?conta=excluida");
  await expect(page.getByText("Sua conta foi excluída")).toBeVisible();
  // Logado? Não: a área do aluno manda para o login.
  await page.goto("/area-do-aluno");
  await page.waitForURL(/\/entrar/);

  await signIn(page, email);
  await expect(page.getByText(/E-mail ou senha incorretos/)).toBeVisible();
  const [row] = await sql<{ name: string; deleted_at: Date | null }>(`SELECT name, deleted_at FROM users WHERE email LIKE 'conta-excluida-%' AND id = (
      SELECT user_id FROM legal_consents c WHERE c.user_id IN (SELECT id FROM users WHERE email LIKE 'conta-excluida-%') ORDER BY accepted_at DESC LIMIT 1)`);
  expect(row.name).toBe("Conta excluída");
  expect(row.deleted_at).not.toBeNull();

  // O mesmo e-mail pode criar uma conta nova.
  await signUp(page, { name: "Aluno De Volta", email });
});
