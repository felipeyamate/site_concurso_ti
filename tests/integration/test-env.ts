/**
 * test-env.ts — Prepara as variáveis de ambiente dos testes de integração.
 *
 * Quem chama: `global-setup.ts` (uma vez) e `setup-env.ts` (antes de cada arquivo de teste).
 *
 * Regras de segurança (os testes APAGAM dados do banco que usam):
 *  1. Exige TEST_DATABASE_URL (no terminal, no CI ou no `.env.local`).
 *  2. Recusa rodar se TEST_DATABASE_URL for igual ao banco do app (DATABASE_URL/DIRECT_URL).
 *  3. Desliga Resend e Google: nenhum e-mail real é enviado durante os testes.
 *  4. Pagamentos SEMPRE simulados (sem ASAAS_API_KEY): nenhuma cobrança real, nem no sandbox.
 *     A NFS-e fica ligada com dados de teste (o provedor simulado "emite" notas sem valor fiscal).
 */
import { config as loadEnv } from "dotenv";

// Marca que o ambiente já foi preparado. Os processos que rodam os testes "herdam" as
// variáveis do processo principal (que já passou por aqui no global-setup), então na
// segunda chamada a DATABASE_URL já é a de teste — e não devemos checar de novo.
const READY_FLAG = "INTEGRATION_TEST_ENV_READY";

export function configureTestEnv(): string {
  if (process.env[READY_FLAG] === "1" && process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  loadEnv({ path: ".env.local", quiet: true });
  loadEnv({ path: ".env", quiet: true });

  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL não definida. Os testes de integração precisam de um banco SEPARADO " +
        "(ex.: uma branch 'test' na Neon). Veja a seção de testes no README.",
    );
  }
  if (testDatabaseUrl === process.env.DATABASE_URL || testDatabaseUrl === process.env.DIRECT_URL) {
    throw new Error(
      "TEST_DATABASE_URL é igual ao banco do app. Use um banco separado: os testes apagam dados.",
    );
  }

  process.env.DATABASE_URL = testDatabaseUrl;
  delete process.env.DIRECT_URL;
  process.env.BETTER_AUTH_SECRET ??= "segredo-apenas-para-testes-com-32-caracteres-ou-mais";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  process.env.RESEND_API_KEY = "";
  process.env.GOOGLE_CLIENT_ID = "";
  process.env.GOOGLE_CLIENT_SECRET = "";
  process.env.ASAAS_API_KEY = "";
  process.env.ASAAS_WEBHOOK_TOKEN = "token-do-webhook-apenas-para-os-testes-0123456789";
  process.env.NFSE_ENABLED = "true";
  process.env.NFSE_SERVICE_DESCRIPTION = "Curso online (teste)";
  process.env.NFSE_MUNICIPAL_SERVICE_ID = "";
  process.env.NFSE_MUNICIPAL_SERVICE_CODE = "08.02";
  process.env.NFSE_MUNICIPAL_SERVICE_NAME = "Ensino (teste)";
  process.env.NFSE_ISS_RATE = "2";
  process.env[READY_FLAG] = "1";

  return testDatabaseUrl;
}
