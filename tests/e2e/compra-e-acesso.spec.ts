/**
 * compra-e-acesso.spec.ts — E2E do caminho do dinheiro: comprar com Pix (pagamento SIMULADO),
 * receber o acesso à aula paga, pedir reembolso e perder o acesso. Mais o cupom na compra.
 *
 * Rodar: npm run test:e2e   (exige o conteúdo de exemplo: npm run db:seed)
 */
import { expect, test, type Page } from "@playwright/test";

import { signUp, uniqueEmail } from "./helpers/accounts";
import { createProductForBaseCourse, sql } from "./helpers/db";

const PAID_LESSON = "/cursos/informatica-e-ti-do-zero/aulas/como-estudar-este-curso";
const CPF = "529.982.247-25";

async function lessonUnlocked(page: Page): Promise<boolean> {
  await page.goto(PAID_LESSON);
  await page.waitForLoadState("domcontentloaded");
  return (await page.locator("video").count()) > 0;
}

test("Pix simulado libera a aula paga; o reembolso em 7 dias tira o acesso na hora", async ({ page }) => {
  const slug = await createProductForBaseCourse(`e2e-base-${Date.now()}`, "Curso Base (E2E)");
  await signUp(page, { name: "Aluno Comprador", email: uniqueEmail("e2e-compra") });
  expect(await lessonUnlocked(page)).toBe(false);
  await expect(page.getByText("Aula bloqueada")).toBeVisible();

  await page.goto(`/comprar/${slug}`);
  await page.locator("#checkout-cpf").fill(CPF);
  await page.locator("input[name=acceptTerms]").check();
  await page.getByRole("button", { name: "Ir para o pagamento" }).click();
  await page.waitForURL(/\/area-do-aluno\/pagamentos\/[^/]+$/);
  await expect(page.getByAltText("QR Code do Pix")).toBeVisible();

  // "Abra a fatura" leva ao simulador (no Asaas de verdade, à fatura). Aprovamos o pagamento.
  const invoice = await page.getByRole("link", { name: "Abra a fatura" }).getAttribute("href");
  await page.goto(invoice as string);
  await page.getByRole("button", { name: "Pagar (aprovar)" }).click();
  await expect(page.getByText("Paga", { exact: true }).first()).toBeVisible();

  expect(await lessonUnlocked(page)).toBe(true);

  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/area-do-aluno/compras");
  await page.getByRole("button", { name: "Pedir reembolso" }).click();
  await expect(page.getByText("Reembolso em andamento")).toBeVisible();
  expect(await lessonUnlocked(page)).toBe(false);
});

test("cupom na compra: preço riscado e o novo preço; cupom inexistente explica o erro", async ({ page }) => {
  const slug = await createProductForBaseCourse(`e2e-cupom-${Date.now()}`, "Curso Base (E2E cupom)");
  const code = `E2E${Date.now()}`.slice(0, 20);
  await sql(
    `INSERT INTO coupons (id, code, description, discount_type, discount_value, applies_to_products, applies_to_plans, max_per_user, is_active, created_at, updated_at)
     VALUES ($1, $1, '', 'PERCENT', 20, true, false, 1, true, now(), now())`,
    [code],
  );
  await signUp(page, { name: "Aluna Cupom", email: uniqueEmail("e2e-cupom") });

  await page.goto(`/comprar/${slug}?cupom=NAOEXISTE`);
  await expect(page.getByText("O cupom NAOEXISTE não existe")).toBeVisible();
  await page.goto(`/comprar/${slug}?cupom=${code.toLowerCase()}`);
  await expect(page.getByText(`Cupom ${code} aplicado: −R$ 39,40`)).toBeVisible();
  await expect(page.locator(".line-through", { hasText: "R$ 197,00" })).toBeVisible();
  await expect(page.getByText("R$ 157,60").first()).toBeVisible();
});
