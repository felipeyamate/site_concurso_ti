/**
 * playwright.config.ts — Configuração dos testes de ponta a ponta (E2E), que usam um navegador de
 * verdade (Chromium) para clicar no site como um aluno faria.
 *
 * Quem usa: `npm run test:e2e` (na sua máquina e no CI).
 * O que faz:
 *  - sobe o site em modo desenvolvimento (`npm run dev`) na porta 3100 — é o modo em que os
 *    pagamentos são SIMULADOS (sem conta no Asaas) e o vídeo de exemplo toca;
 *  - roda os testes de `tests/e2e/` um de cada vez (eles criam contas e compras no mesmo banco);
 *  - usa o banco do `.env.local` (o de desenvolvimento, com o `npm run db:seed` aplicado). No CI,
 *    um PostgreSQL temporário.
 * Paralelo em Python: é o `pytest` + `playwright` para Python, com a mesma API.
 */
import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Os testes também falam direto com o banco (ex.: promover alguém a admin): precisam da DATABASE_URL.
loadEnv({ path: ".env.local", quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_BASE_URL = `http://localhost:${PORT}`;
export const E2E_CRON_SECRET = "segredo-das-tarefas-so-para-os-testes-e2e";

export default defineConfig({
  testDir: "tests/e2e",
  // A primeira visita a cada página compila o código (modo desenvolvimento): pode levar alguns segundos.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `${E2E_BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      BETTER_AUTH_URL: E2E_BASE_URL,
      // Sempre o provedor SIMULADO nos testes (nunca cobrar de verdade), mesmo com o Asaas no .env.local.
      ASAAS_API_KEY: "",
      ASAAS_WEBHOOK_TOKEN: "token-do-webhook-apenas-para-os-testes-e2e-0123456789",
      CRON_SECRET: E2E_CRON_SECRET,
      // Análise de uso desligada nos testes (sem aviso de cookies atrapalhando os cliques).
      NEXT_PUBLIC_POSTHOG_KEY: "",
      NEXT_PUBLIC_SENTRY_DSN: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
