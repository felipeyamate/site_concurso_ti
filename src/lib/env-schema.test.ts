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
});
