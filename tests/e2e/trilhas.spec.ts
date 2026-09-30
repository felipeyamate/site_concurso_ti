/**
 * trilhas.spec.ts — E2E das trilhas de estudo (Fase 8), no navegador: a trilha de exemplo para o
 * visitante (etapas, cadeados, treinos filtrados), o progresso do aluno (responder uma questão conta no
 * treino; errar/acertar mostra "estude esta aula"), o professor montando uma trilha pelo "o que mais
 * cai" no painel, e a página de concurso indicando a trilha.
 *
 * Rodar: npm run test:e2e   (exige o conteúdo de exemplo: npm run db:seed)
 */
import { expect, test } from "@playwright/test";

import { signUp, uniqueEmail } from "./helpers/accounts";
import { setRole } from "./helpers/db";

const SEED_TRACK = "/trilhas/exemplo-trilha-cesgranrio-banco";

test("visitante: a trilha de exemplo mostra as etapas, as aulas com cadeado e os treinos já filtrados", async ({ page }) => {
  await page.goto("/trilhas");
  await page.getByRole("link", { name: "Exemplo — Trilha Cesgranrio (Banco)" }).click();
  await expect(page).toHaveURL(new RegExp(`${SEED_TRACK}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Exemplo — Trilha Cesgranrio (Banco)" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /^Etapa 1 — / })).toBeVisible();
  // A primeira etapa é o que mais cai na banca (a página mostra a porcentagem).
  await expect(page.getByText(/cai em [\d,]+% das questões da Cesgranrio/).first()).toBeVisible();
  // Sem matrícula: aulas com cadeado (a trilha não libera nada).
  await expect(page.locator('[aria-label="Aula bloqueada"]').first()).toBeVisible();
  const practice = page.getByRole("link", { name: /^Treinar .*\(Cesgranrio\)$/ }).first();
  expect(await practice.getAttribute("href")).toMatch(/^\/questoes\?assunto=[a-z0-9-]+&banca=cesgranrio$/);
  await expect(page.getByText("para acompanhar o seu progresso na trilha")).toBeVisible();
});

test("aluno: responder uma questão do treino conta na trilha; depois de responder, 'estude esta aula'", async ({ page }) => {
  await signUp(page, { name: "Aluna Trilha", email: uniqueEmail("e2e-trilha") });
  await page.goto(SEED_TRACK);
  await expect(page.getByText(/^Você fez 0 de \d+ passos$/)).toBeVisible();
  const practice = page.getByRole("link", { name: /^Treinar .*\(Cesgranrio\)$/ }).first();
  const practiceName = (await practice.textContent()) as string;
  await practice.click();
  await page.waitForURL(/\/questoes\?assunto=/);

  // Responde a primeira questão da lista (fixada pela posição — depois de responder, o botão some).
  const cards = page.locator("[data-slot=card]");
  let index = 0;
  while ((await cards.nth(index).getByRole("button", { name: "Responder" }).count()) === 0) index += 1;
  const card = cards.nth(index);
  await card.locator("input[type=radio]").first().check();
  await card.getByRole("button", { name: "Responder" }).click();
  await expect(card.getByText(/^Você (acertou!|errou\.)/)).toBeVisible();
  // O assunto tem aulas no Curso Base: a questão indica o que estudar.
  await expect(card.getByText(/Estude esta aula antes de tentar de novo:|Quer revisar o assunto\?/)).toBeVisible();
  await expect(card.getByRole("link").filter({ hasNotText: "Ver planos" }).first()).toHaveAttribute("href", /^\/cursos\/informatica-e-ti-do-zero\/aulas\//);

  // De volta à trilha: o treino conta a questão respondida.
  await page.goto(SEED_TRACK);
  const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: practiceName, exact: true }) });
  await expect(row.getByText(/^1 de 10 questões/)).toBeVisible();

  // A página da aula leva às questões do assunto dela.
  await page.goto("/cursos/informatica-e-ti-do-zero/aulas/pilares-da-seguranca");
  await expect(page.getByRole("link", { name: "Questões de Segurança da Informação" })).toHaveAttribute("href", "/questoes?assunto=seguranca-da-informacao");
});

test("professor: monta uma trilha pelo 'o que mais cai' no painel, publica e ela aparece em /trilhas", async ({ page }) => {
  const email = uniqueEmail("e2e-prof-trilha");
  await signUp(page, { name: "Professora Trilha", email });
  await setRole(email, "TEACHER");
  const title = `Trilha E2E ${Date.now()}`;

  await page.goto("/admin/conteudo/trilhas/nova");
  await page.getByLabel("Título da trilha").fill(title);
  await page.getByLabel("Banca", { exact: true }).selectOption({ label: "Cesgranrio" });
  await expect(page.getByRole("checkbox", { name: /Já montar as etapas/ })).toBeChecked();
  await page.getByRole("button", { name: "Criar trilha" }).click();
  await page.waitForURL(/\/admin\/conteudo\/trilhas\/(?!nova$)[^/]+$/);
  await expect(page.getByRole("heading", { level: 2, name: /^Etapa 1 — / })).toBeVisible();
  await expect(page.getByText(/^Treinar .* · Cesgranrio · meta de 10 questões$/).first()).toBeVisible();

  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByRole("button", { name: "Despublicar" })).toBeVisible();
  await page.goto("/trilhas");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("página de concurso indica a trilha de estudos", async ({ page }) => {
  await page.goto("/concursos/exemplo-banco-escriturario-2026");
  await expect(page.getByRole("link", { name: "Seguir a trilha" })).toHaveAttribute("href", SEED_TRACK);
});
