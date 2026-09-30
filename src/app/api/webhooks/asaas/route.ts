/**
 * route.ts — /api/webhooks/asaas: onde o Asaas avisa que um pagamento mudou (pago, estornado...).
 *
 * Quem chama: o PRÓPRIO Asaas (configurado no painel dele: Integrações → Webhooks), nunca o aluno.
 *
 * Passos:
 *  1. Confere o token: o Asaas manda, no cabeçalho `asaas-access-token`, o mesmo valor que está na
 *     nossa ASAAS_WEBHOOK_TOKEN. Sem ele (ou errado) → 401. É isso que impede alguém de "fingir"
 *     um pagamento mandando um aviso falso para este endereço.
 *  2. Lê o JSON e entrega para `receiveWebhook` (grava uma vez só e processa).
 *  3. Responde 200 ("recebido") — inclusive quando o processamento deu erro (o erro fica gravado
 *     para reprocessar pelo painel; ver o porquê em `webhook.server.ts`). Só responde erro quando
 *     nem conseguiu GRAVAR o aviso (ex.: banco fora do ar): aí o Asaas reenvia mais tarde.
 */
import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { receiveWebhook } from "@/modules/payments/webhook.server";

/**
 * Compara dois textos sem "vazar" pelo tempo de resposta quantos caracteres batem.
 * (Comparar hashes de mesmo tamanho permite usar `timingSafeEqual` com textos de tamanhos diferentes.)
 */
function sameSecret(received: string, expected: string): boolean {
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest): Promise<Response> {
  const expectedToken = env.ASAAS_WEBHOOK_TOKEN;
  if (!expectedToken) {
    return json({ error: "Webhook do Asaas não configurado neste site." }, 503);
  }
  const token = request.headers.get("asaas-access-token") ?? "";
  if (!token || !sameSecret(token, expectedToken)) {
    return json({ error: "Token inválido." }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Corpo do aviso não é um JSON válido." }, 400);
  }

  const result = await receiveWebhook({ provider: "ASAAS", body });
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ received: true, status: result.outcome.status }, 200);
}
