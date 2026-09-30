/**
 * route.ts — Tarefa agendada: conferir no provedor as cobranças em aberto (/api/cron/conferir-pagamentos).
 *
 * Quem chama: a Vercel Cron, de hora em hora (ver `vercel.json`), com o segredo CRON_SECRET.
 * O que faz: `reconcileOpenPayments` — pega avisos (webhooks) perdidos do Asaas, para nenhum aluno
 * pagar e ficar sem acesso. Devolve quantas cobranças conferiu (aparece no log da Vercel).
 * Sem o segredo certo → 401 (ninguém de fora dispara a tarefa).
 */
import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { env } from "@/lib/env";
import { reconcileOpenPayments } from "@/modules/payments/reconcile.server";

// Tempo máximo desta função na Vercel (segundos). A conferência para antes, com folga (45 s).
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), env.CRON_SECRET)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const result = await reconcileOpenPayments();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
