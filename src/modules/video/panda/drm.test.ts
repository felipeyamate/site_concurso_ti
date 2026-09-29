/**
 * drm.test.ts — Testes do token da marca d'água (DRM) do Panda.
 * Rodar: npm test
 */
import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createPandaWatermarkToken, WATERMARK_TOKEN_TTL_SECONDS } from "./drm";

const viewer = { id: "user_123", name: "Maria Silva", email: "maria@exemplo.com" };

function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

describe("createPandaWatermarkToken", () => {
  const token = createPandaWatermarkToken({ groupId: "grupo-1", secret: "segredo", viewer, nowSeconds: 1_000 });
  const [header, payload, signature] = token.split(".");

  it("gera um JWT HS256 com o grupo, os dados do aluno e a validade", () => {
    expect(decodePart(header)).toEqual({ alg: "HS256", typ: "JWT" });
    expect(decodePart(payload)).toEqual({
      drm_group_id: "grupo-1",
      string1: "Maria Silva",
      string2: "maria@exemplo.com",
      string3: "ID user_123",
      iat: 1_000,
      exp: 1_000 + WATERMARK_TOKEN_TTL_SECONDS,
    });
  });

  it("assina com HMAC-SHA256 usando o segredo do grupo (o Panda confere a assinatura)", () => {
    const expected = createHmac("sha256", "segredo").update(`${header}.${payload}`).digest("base64url");
    expect(signature).toBe(expected);
    const other = createPandaWatermarkToken({ groupId: "grupo-1", secret: "outro", viewer, nowSeconds: 1_000 });
    expect(other.split(".")[2]).not.toBe(signature);
  });

  it("limita textos longos e usa 'Aluno' quando não há nome", () => {
    const long = createPandaWatermarkToken({
      groupId: "g",
      secret: "s",
      viewer: { ...viewer, name: "", email: `${"a".repeat(200)}@x.com` },
      nowSeconds: 0,
    });
    const data = decodePart(long.split(".")[1]);
    expect(data.string1).toBe("Aluno");
    expect(String(data.string2).length).toBe(80);
  });
});
