/**
 * route.ts — /api/dev-storage: recebe envios e entrega downloads do armazenamento LOCAL.
 *
 * Quem chama: o navegador, usando os links temporários gerados por
 * `src/modules/storage/local-storage.server.ts` (o mesmo papel dos links assinados do R2).
 *   PUT /api/dev-storage?op=upload&...&sig=...    → grava o PDF enviado pelo painel admin
 *   GET /api/dev-storage?op=download&...&sig=...  → devolve o PDF (link gerado após checar o acesso)
 *
 * Só funciona FORA de produção. Em produção responde 404 sempre (lá os PDFs ficam no R2).
 * Não consulta sessão: quem decide o acesso é quem GEROU o link (a assinatura garante que o link
 * não foi alterado e que ainda está no prazo).
 */
import "server-only";

import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { readLocalObject, writeLocalObject } from "@/modules/storage/local-storage.server";
import { verifyLocalSignedUrl, type LocalStorageOperation } from "@/modules/storage/local-signature";

function notFound(): Response {
  return new Response("Não encontrado.", { status: 404 });
}

// Passo comum: bloqueia em produção e confere assinatura + prazo + operação.
function verify(request: NextRequest, operation: LocalStorageOperation) {
  if (env.NODE_ENV === "production") return null;
  const result = verifyLocalSignedUrl({
    secret: env.BETTER_AUTH_SECRET,
    searchParams: request.nextUrl.searchParams,
    expectedOperation: operation,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  return result.ok ? result.params : null;
}

/**
 * Envio do arquivo (PUT).
 * Passos: confere o link; confere o tipo (igual ao assinado); lê o corpo respeitando o tamanho
 * máximo assinado; grava na pasta local.
 */
export async function PUT(request: NextRequest): Promise<Response> {
  const params = verify(request, "upload");
  if (!params) return notFound();

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType !== params.type) {
    return new Response("Tipo de arquivo diferente do combinado.", { status: 400 });
  }
  const maxBytes = Number(params.max);
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxBytes) {
    return new Response("Arquivo grande demais.", { status: 413 });
  }

  const data = new Uint8Array(await request.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > maxBytes) {
    return new Response("Arquivo vazio ou grande demais.", { status: 413 });
  }
  await writeLocalObject(env.LOCAL_STORAGE_DIR, params.key, data);
  return new Response(null, { status: 200 });
}

/** Download do arquivo (GET), com o tipo e o nome definidos no link. */
export async function GET(request: NextRequest): Promise<Response> {
  const params = verify(request, "download");
  if (!params) return notFound();

  const data = await readLocalObject(env.LOCAL_STORAGE_DIR, params.key);
  if (!data) return notFound();

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": params.type,
      "Content-Disposition": params.disposition,
      // O navegador não deve "adivinhar" outro tipo, nem guardar o arquivo em cache compartilhado.
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
