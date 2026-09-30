/**
 * env-schema.test.ts — Testes da validação das variáveis de ambiente.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { parseEnv } from "./env-schema";

const validEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("aceita o mínimo obrigatório e aplica os valores padrão", () => {
    const env = parseEnv(validEnv);
    expect(env.NODE_ENV).toBe("development");
    expect(env.EMAIL_FROM).toContain("@");
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it("trata variáveis vazias como não informadas", () => {
    const env = parseEnv({ ...validEnv, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", RESEND_API_KEY: "" });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("lista TODOS os problemas de uma vez, em português", () => {
    expect(() => parseEnv({ BETTER_AUTH_SECRET: "curto" })).toThrowError(
      /DATABASE_URL[\s\S]*BETTER_AUTH_SECRET[\s\S]*BETTER_AUTH_URL/,
    );
  });

  it("recusa string de conexão que não é PostgreSQL", () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: "mysql://x" })).toThrowError(/postgresql/);
  });

  it("exige as duas chaves do Google juntas", () => {
    expect(() => parseEnv({ ...validEnv, GOOGLE_CLIENT_ID: "id-sem-segredo" })).toThrowError(
      /GOOGLE_CLIENT_SECRET/,
    );
    const env = parseEnv({ ...validEnv, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "segredo" });
    expect(env.GOOGLE_CLIENT_ID).toBe("id");
  });

  it("em produção com Resend, recusa o remetente de teste @resend.dev", () => {
    const production = { ...validEnv, NODE_ENV: "production", RESEND_API_KEY: "re_123" };
    expect(() => parseEnv(production)).toThrowError(/EMAIL_FROM/);
    expect(parseEnv({ ...production, EMAIL_FROM: "Concurso TI <contato@meusite.com.br>" }).EMAIL_FROM).toContain(
      "meusite",
    );
    // Sem chave do Resend (ex.: build no CI) ou fora de produção, o padrão continua valendo.
    expect(() => parseEnv({ ...validEnv, NODE_ENV: "production" })).not.toThrow();
    expect(() => parseEnv({ ...validEnv, RESEND_API_KEY: "re_123" })).not.toThrow();
  });

  it("Panda: DRM exige o grupo e o segredo juntos; a chave da API é independente", () => {
    expect(() => parseEnv({ ...validEnv, PANDA_DRM_GROUP_ID: "grupo" })).toThrowError(/PANDA_DRM_SECRET/);
    expect(() => parseEnv({ ...validEnv, PANDA_DRM_SECRET: "segredo" })).toThrowError(/PANDA_DRM_GROUP_ID/);
    const env = parseEnv({ ...validEnv, PANDA_DRM_GROUP_ID: "grupo", PANDA_DRM_SECRET: "segredo", PANDA_API_KEY: "" });
    expect(env.PANDA_DRM_GROUP_ID).toBe("grupo");
    expect(env.PANDA_API_KEY).toBeUndefined();
  });

  it("R2: as quatro variáveis juntas ou nenhuma", () => {
    expect(() => parseEnv({ ...validEnv, R2_BUCKET: "materiais" })).toThrowError(
      /R2_ACCOUNT_ID[\s\S]*R2_ACCESS_KEY_ID[\s\S]*R2_SECRET_ACCESS_KEY/,
    );
    const env = parseEnv({
      ...validEnv,
      R2_ACCOUNT_ID: "conta",
      R2_ACCESS_KEY_ID: "chave",
      R2_SECRET_ACCESS_KEY: "segredo",
      R2_BUCKET: "materiais",
    });
    expect(env.R2_BUCKET).toBe("materiais");
    expect(parseEnv(validEnv).LOCAL_STORAGE_DIR).toBe(".data/uploads");
  });

  it("Asaas: com a chave, exige o token do webhook (longo); ambiente padrão é o sandbox", () => {
    expect(() => parseEnv({ ...validEnv, ASAAS_API_KEY: "$aact_123" })).toThrowError(/ASAAS_WEBHOOK_TOKEN/);
    expect(() => parseEnv({ ...validEnv, ASAAS_API_KEY: "$aact_123", ASAAS_WEBHOOK_TOKEN: "curto" })).toThrowError(
      /32 caracteres/,
    );
    const env = parseEnv({ ...validEnv, ASAAS_API_KEY: "$aact_123", ASAAS_WEBHOOK_TOKEN: "t".repeat(32) });
    expect(env.ASAAS_ENVIRONMENT).toBe("sandbox");
    expect(() => parseEnv({ ...validEnv, ASAAS_ENVIRONMENT: "producao" })).toThrowError(/ASAAS_ENVIRONMENT/);
  });

  it("NFS-e: desligada por padrão; ligada, exige descrição, serviço municipal e ISS", () => {
    expect(parseEnv(validEnv).NFSE_ENABLED).toBe("false");
    expect(() => parseEnv({ ...validEnv, NFSE_ENABLED: "true" })).toThrowError(
      /NFSE_SERVICE_DESCRIPTION[\s\S]*NFSE_MUNICIPAL_SERVICE_NAME[\s\S]*NFSE_ISS_RATE[\s\S]*NFSE_MUNICIPAL_SERVICE_CODE/,
    );
    const env = parseEnv({
      ...validEnv,
      NFSE_ENABLED: "true",
      NFSE_SERVICE_DESCRIPTION: "Curso online",
      NFSE_MUNICIPAL_SERVICE_CODE: "08.02",
      NFSE_MUNICIPAL_SERVICE_NAME: "Instrução, treinamento",
      NFSE_ISS_RATE: "2.5",
    });
    expect(env.NFSE_ISS_RATE).toBe(2.5);
  });

  it("Fase 7: site oficial exige os dados da empresa (Termos/Privacidade); fora dele, são opcionais", () => {
    expect(parseEnv(validEnv).LEGAL_COMPANY_NAME).toBeUndefined();
    expect(() => parseEnv({ ...validEnv, VERCEL_ENV: "production" })).toThrowError(/LEGAL_COMPANY_NAME[\s\S]*LEGAL_CONTACT_EMAIL/);
    const official = parseEnv({
      ...validEnv,
      VERCEL_ENV: "production",
      LEGAL_COMPANY_NAME: "Concurso TI Educação Ltda.",
      LEGAL_COMPANY_DOCUMENT: "12.345.678/0001-90",
      LEGAL_CONTACT_EMAIL: "privacidade@exemplo.com.br",
    });
    expect(official.LEGAL_CONTACT_EMAIL).toBe("privacidade@exemplo.com.br");
    expect(() => parseEnv({ ...validEnv, LEGAL_CONTACT_EMAIL: "sem-arroba" })).toThrowError(/LEGAL_CONTACT_EMAIL/);
  });

  it("Fase 7: segredo das tarefas agendadas precisa ser longo; PostHog tem endereço padrão", () => {
    expect(() => parseEnv({ ...validEnv, CRON_SECRET: "curto" })).toThrowError(/CRON_SECRET/);
    expect(parseEnv({ ...validEnv, CRON_SECRET: "x".repeat(16) }).CRON_SECRET).toHaveLength(16);
    expect(parseEnv(validEnv).NEXT_PUBLIC_POSTHOG_HOST).toBe("https://us.i.posthog.com");
  });

  it("Fase 7: no preview da Vercel, o endereço do site é o do próprio preview", () => {
    const preview = parseEnv({ ...validEnv, BETTER_AUTH_URL: "https://site-oficial.com.br", VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "site-git-teste.vercel.app", VERCEL_URL: "site-abc123.vercel.app" });
    expect(preview.BETTER_AUTH_URL).toBe("https://site-git-teste.vercel.app");
    // Sem BETTER_AUTH_URL cadastrada para os previews: usa o endereço do deploy.
    const withoutUrl = { ...validEnv, BETTER_AUTH_URL: undefined };
    expect(parseEnv({ ...withoutUrl, VERCEL_ENV: "preview", VERCEL_URL: "site-abc123.vercel.app" }).BETTER_AUTH_URL).toBe("https://site-abc123.vercel.app");
    // No site oficial nada muda.
    expect(parseEnv({ ...validEnv, VERCEL_URL: "site-abc123.vercel.app" }).BETTER_AUTH_URL).toBe("http://localhost:3000");
  });
});
