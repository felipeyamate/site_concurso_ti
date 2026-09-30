/**
 * route.ts — Tarefa agendada: limpeza diária de registros vencidos (/api/cron/limpeza).
 *
 * Quem chama: a Vercel Cron, uma vez por dia (ver `vercel.json`), com o segredo CRON_SECRET.
 * O que faz: `cleanupExpiredRecords` — apaga logins vencidos, códigos de verificação vencidos e
 * contadores antigos de tentativas de login. Devolve quantos apagou (aparece no log da Vercel).
 * Sem o segredo certo → 401.
 */
import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { env } from "@/lib/env";
import { cleanupExpiredRecords } from "@/modules/maintenance/cleanup.server";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), env.CRON_SECRET)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const result = await cleanupExpiredRecords();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
