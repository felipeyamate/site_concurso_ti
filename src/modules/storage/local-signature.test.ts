/**
 * local-signature.test.ts — Testes dos links assinados do armazenamento local.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { buildLocalSignedUrl, verifyLocalSignedUrl } from "./local-signature";

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
const KEY = "lessons/aula/123e4567-e89b-42d3-a456-426614174000.pdf";

function paramsOf(url: string): URLSearchParams {
  return new URL(url, "http://localhost").searchParams;
}

describe("links assinados do armazenamento local", () => {
  const url = buildLocalSignedUrl({
    secret: SECRET,
    operation: "download",
    key: KEY,
    expiresAt: 1000,
    extra: { type: "application/pdf" },
  });

  it("aceita o link como foi gerado, dentro do prazo", () => {
    const result = verifyLocalSignedUrl({
      secret: SECRET,
      searchParams: paramsOf(url),
      expectedOperation: "download",
      nowSeconds: 999,
    });
    expect(result).toEqual({
      ok: true,
      params: { op: "download", key: KEY, expires: "1000", type: "application/pdf" },
    });
  });

  it("recusa link vencido", () => {
    const result = verifyLocalSignedUrl({
      secret: SECRET,
      searchParams: paramsOf(url),
      expectedOperation: "download",
      nowSeconds: 1001,
    });
    expect(result).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("recusa link alterado (outro arquivo, outro prazo) ou com outro segredo", () => {
    const tampered = paramsOf(url);
    tampered.set("key", "lessons/outra/123e4567-e89b-42d3-a456-426614174000.pdf");
    expect(verifyLocalSignedUrl({ secret: SECRET, searchParams: tampered, expectedOperation: "download", nowSeconds: 0 }).ok).toBe(false);

    const extended = paramsOf(url);
    extended.set("expires", "999999");
    expect(verifyLocalSignedUrl({ secret: SECRET, searchParams: extended, expectedOperation: "download", nowSeconds: 0 }).ok).toBe(false);

    expect(
      verifyLocalSignedUrl({ secret: "outro-segredo", searchParams: paramsOf(url), expectedOperation: "download", nowSeconds: 0 }).ok,
    ).toBe(false);
  });

  it("link de download não serve para enviar arquivo", () => {
    const result = verifyLocalSignedUrl({
      secret: SECRET,
      searchParams: paramsOf(url),
      expectedOperation: "upload",
      nowSeconds: 0,
    });
    expect(result).toEqual({ ok: false, reason: "INVALID" });
  });

  it("recusa link sem assinatura", () => {
    const unsigned = paramsOf(url);
    unsigned.delete("sig");
    expect(verifyLocalSignedUrl({ secret: SECRET, searchParams: unsigned, expectedOperation: "download", nowSeconds: 0 }).ok).toBe(false);
  });
});
