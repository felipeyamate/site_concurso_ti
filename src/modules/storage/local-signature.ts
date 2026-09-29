/**
 * local-signature.ts — Assina e confere os links temporários do armazenamento LOCAL (desenvolvimento).
 *
 * Quem chama: `local-storage.server.ts` (gera os links) e a rota `/api/dev-storage` (confere).
 *
 * Por que existe: o R2 gera links assinados sozinho. Para o armazenamento local funcionar do mesmo
 * jeito (e o resto do código não precisar saber qual está em uso), imitamos a ideia: o link leva os
 * parâmetros + uma assinatura HMAC feita com um segredo do servidor. Mudar qualquer parâmetro
 * (outro arquivo, outro prazo) invalida a assinatura.
 *
 * Paralelo em Python: é o `hmac.new(chave, mensagem, hashlib.sha256)` — como o `signing` do Django.
 */
import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type LocalStorageOperation = "upload" | "download";

// Parâmetros assinados (todos viram texto na URL).
export type LocalSignedParams = Record<string, string>;

// Deriva uma chave só para este uso a partir do segredo do app ("separação de domínio"): uma
// assinatura daqui nunca serve em outro lugar que também use o BETTER_AUTH_SECRET.
function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(`local-storage-v1:${secret}`).digest();
}

// Texto canônico: parâmetros em ordem alfabética, "nome=valor" por linha.
function canonicalize(params: LocalSignedParams): string {
  return Object.keys(params)
    .sort()
    .map((name) => `${name}=${params[name]}`)
    .join("\n");
}

/** Calcula a assinatura dos parâmetros (inclua sempre `op`, `key` e `expires`). */
export function signLocalParams(secret: string, params: LocalSignedParams): string {
  return createHmac("sha256", deriveKey(secret)).update(canonicalize(params)).digest("base64url");
}

/**
 * Monta a URL assinada: /api/dev-storage?op=...&key=...&expires=...&sig=...
 * `expiresAt` em segundos desde 1970 (como o `time.time()` do Python).
 */
export function buildLocalSignedUrl(params: {
  secret: string;
  operation: LocalStorageOperation;
  key: string;
  expiresAt: number;
  extra?: LocalSignedParams;
}): string {
  const signed: LocalSignedParams = {
    ...params.extra,
    op: params.operation,
    key: params.key,
    expires: String(params.expiresAt),
  };
  const search = new URLSearchParams({ ...signed, sig: signLocalParams(params.secret, signed) });
  return `/api/dev-storage?${search.toString()}`;
}

export type VerifiedLocalRequest =
  | { ok: true; params: LocalSignedParams }
  | { ok: false; reason: "INVALID" | "EXPIRED" };

/**
 * Confere um link recebido.
 *
 * Passos:
 *  1. Separa a assinatura (`sig`) dos demais parâmetros.
 *  2. Recalcula a assinatura e compara em tempo constante (`timingSafeEqual`, contra ataques
 *     que medem o tempo da comparação).
 *  3. Confere a operação esperada (um link de download não serve para enviar) e o prazo.
 */
export function verifyLocalSignedUrl(params: {
  secret: string;
  searchParams: URLSearchParams;
  expectedOperation: LocalStorageOperation;
  nowSeconds: number;
}): VerifiedLocalRequest {
  const received: LocalSignedParams = {};
  let signature = "";
  for (const [name, value] of params.searchParams) {
    if (name === "sig") signature = value;
    else received[name] = value;
  }
  if (!signature || !received.op || !received.key || !received.expires) {
    return { ok: false, reason: "INVALID" };
  }

  const expected = Buffer.from(signLocalParams(params.secret, received));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "INVALID" };
  }
  if (received.op !== params.expectedOperation) {
    return { ok: false, reason: "INVALID" };
  }
  const expiresAt = Number(received.expires);
  if (!Number.isFinite(expiresAt) || expiresAt < params.nowSeconds) {
    return { ok: false, reason: "EXPIRED" };
  }
  return { ok: true, params: received };
}
