/**
 * site.spec.ts — E2E do site aberto e das peças de produção: páginas públicas, SEO, cabeçalhos de
 * segurança, saúde, tarefas agendadas protegidas, questões grátis, link de afiliado, painel fechado
 * para alunos e celular (360 px) sem rolagem para o lado.
 *
 * Rodar: npm run test:e2e   (exige o conteúdo de exemplo: npm run db:seed)
 */
import { expect, test } from "@playwright/test";

import { E2E_CRON_SECRET } from "../../playwright.config";
import { signUp, uniqueEmail } from "./helpers/accounts";
import { sql } from "./helpers/db";

test("páginas públicas abrem; termos e privacidade mostram a versão", async ({ page }) => {
  for (const [path, heading] of [
    ["/", "Informática e TI para concursos, do zero"],
    ["/cursos", null],
    ["/trilhas", "Trilhas de estudo"],
    ["/blog", "Blog"],
    ["/concursos", null],
    ["/o-que-mais-cai", "O que mais cai de TI nos concursos"],
    ["/termos", "Termos de uso"],
    ["/privacidade", "Política de privacidade"],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    if (heading) await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  await page.goto("/privacidade");
  await expect(page.getByText(/^Versão de /)).toBeVisible();
  await expect(page.getByText("Sentry — avisos de erro do site, sem nome, e-mail ou CPF.")).toBeVisible();
});

test("SEO, saúde, cabeçalhos de segurança e tarefas agendadas protegidas", async ({ request }) => {
  const home = await request.get("/");
  expect(home.headers()["x-frame-options"]).toBe("DENY");
  expect(home.headers()["x-content-type-options"]).toBe("nosniff");
  expect(home.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");

  expect(await (await request.get("/sitemap.xml")).text()).toContain("<urlset");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  expect(robots).toContain("Disallow: /aceitar-termos");

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });

  expect((await request.get("/api/cron/limpeza")).status()).toBe(401);
  expect((await request.get("/api/cron/limpeza", { headers: { authorization: "Bearer chute" } })).status()).toBe(401);
  const cleanup = await request.get("/api/cron/limpeza", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
  expect(cleanup.status()).toBe(200);
  expect(await cleanup.json()).toHaveProperty("sessions");
});

test("conta grátis resolve uma questão: gabarito e comentário só depois de responder", async ({ page }) => {
  await signUp(page, { name: "Aluna Questões", email: uniqueEmail("e2e-questoes") });
  await page.goto("/questoes");
  await expect(page.getByText("Hoje você ainda tem 10 questões grátis")).toBeVisible();
  // O card é fixado pela POSIÇÃO: depois de responder, o botão "Responder" some, e um filtro por ele
  // passaria a achar o card seguinte.
  const cards = page.locator("[data-slot=card]");
  let index = 0;
  while ((await cards.nth(index).getByRole("button", { name: "Responder" }).count()) === 0) index += 1;
  const card = cards.nth(index);
  await card.locator("input[type=radio]").first().check();
  await card.getByRole("button", { name: "Responder" }).click();
  await expect(card.getByText(/^Você (acertou!|errou\.)/)).toBeVisible();
  await expect(card.getByText("Restam 9 questões grátis hoje.")).toBeVisible();
});

test("link de afiliado: guarda quem indicou (cookie de 30 dias) e nunca leva para fora do site", async ({ browser }) => {
  const code = `e2e-${Date.now()}`.slice(0, 30);
  const owner = await browser.newPage();
  const email = uniqueEmail("e2e-afiliada");
  await signUp(owner, { name: "Parceira E2E", email });
  await sql(
    `INSERT INTO affiliates (id, user_id, code, commission_bps, payout_info, is_active, created_at, updated_at)
     SELECT $1, id, $1, 1000, '', true, now(), now() FROM users WHERE email = $2`,
    [code, email],
  );

  const visitor = await browser.newContext();
  const page = await visitor.newPage();
  await page.goto(`/r/${code}?para=/cursos`);
  await expect(page).toHaveURL(/\/cursos$/);
  const cookie = (await visitor.cookies()).find((item) => item.name === "ct_afiliado");
  expect(cookie?.value).toBe(code);
  expect(cookie?.httpOnly).toBe(true);
  await page.goto(`/r/${code}?para=https://golpe.exemplo.com`);
  await expect(page).toHaveURL(/localhost:\d+\/$/);
});

test("aluno não vê o painel admin (a área nem aparece: 404)", async ({ page }) => {
  await signUp(page, { name: "Aluno Curioso", email: uniqueEmail("e2e-painel") });
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
});

test("celular (360 px): páginas principais sem rolagem para o lado", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const page = await context.newPage();
  // Espera a página terminar de carregar (no modo desenvolvimento, o CSS chega depois do HTML) e
  // confere por alguns segundos: uma rolagem lateral de verdade não some sozinha.
  async function expectNoOverflow(path: string) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), { message: path, timeout: 10_000 })
      .toBe(true);
  }
  for (const path of ["/", "/cursos", "/trilhas", "/trilhas/exemplo-trilha-cesgranrio-banco", "/blog", "/concursos", "/o-que-mais-cai", "/termos", "/privacidade", "/cadastro"]) {
    await expectNoOverflow(path);
  }
  // E-mail comprido de propósito: aparece no topo da área do aluno e no aviso de confirmação.
  await signUp(page, { name: "Aluno Celular", email: uniqueEmail("e2e-celular-com-email-bem-comprido") });
  for (const path of ["/area-do-aluno", "/area-do-aluno/conta", "/area-do-aluno/compras", "/questoes"]) {
    await expectNoOverflow(path);
  }
  await context.close();
});
