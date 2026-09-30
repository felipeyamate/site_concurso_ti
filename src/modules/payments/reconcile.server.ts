/**
 * reconcile.server.ts — Confere sozinho, no provedor, as cobranças em aberto (pega aviso perdido).
 *
 * Quem chama: a tarefa agendada /api/cron/conferir-pagamentos (de hora em hora, na Vercel). Os
 * testes de integração chamam direto.
 *
 * Por que existe: o acesso só é liberado pelo aviso (webhook) do Asaas. Se um aviso se perder (o
 * Asaas desiste depois de várias tentativas, ou o site estava fora do ar), o aluno pagou e não
 * recebeu o acesso. Antes, só o admin resolvia ("Conferir no Asaas"); agora a tarefa faz a mesma
 * conferência (`syncPaymentWithProvider`) automaticamente.
 *
 * Quais cobranças: aguardando pagamento, vencidas (o boleto por 90 dias; Pix e cartão por 3 dias) e com estorno em andamento,
 * dos últimos 90 dias — começando pelas que estão há mais tempo sem conferir, no máximo `limit` por
 * rodada e parando antes do tempo limite da função. Cada cobrança é conferida de novo só depois de 1 hora.
 */
import "server-only";

import type { PaymentProviderKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

import { syncPaymentWithProvider } from "./admin/sales-admin.server";
import { getProviderForRecord } from "./provider/provider.server";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Pix/cartão vencidos continuam sendo conferidos por estes dias (um pagamento de última hora cujo aviso se perdeu).
const RECENTLY_OVERDUE_DAYS = 3;

export type ReconcileResult = { checked: number; failed: number; skippedForTime: boolean };

export async function reconcileOpenPayments(input: { now?: Date; limit?: number; timeBudgetMs?: number } = {}): Promise<ReconcileResult> {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 25;
  const deadline = Date.now() + (input.timeBudgetMs ?? 45_000);
  // Só os provedores que funcionam agora: em produção, o Asaas. O simulado entra fora de produção
  // (é assim que os testes exercitam a tarefa); na página de simulação, a consulta dele é recusada.
  const providers = (["ASAAS", "FAKE"] as const).filter((kind): kind is PaymentProviderKind => getProviderForRecord(kind) !== null);
  if (providers.length === 0) return { checked: 0, failed: 0, skippedForTime: false };

  const candidates = await prisma.payment.findMany({
    where: {
      provider: { in: providers },
      // Vencidas: o BOLETO pode ser pago com atraso (fica na lista pelos 90 dias); Pix e cartão, só nos
      // primeiros dias depois do vencimento. Senão os Pix abandonados (que nunca serão pagos) ocupariam,
      // de hora em hora, as 25 vagas de cada rodada no lugar das cobranças que importam.
      OR: [
        { status: { in: ["PENDING", "REFUND_REQUESTED"] } },
        { status: "OVERDUE", method: "BOLETO" },
        { status: "OVERDUE", dueDate: { gte: new Date(now.getTime() - RECENTLY_OVERDUE_DAYS * DAY_MS) } },
      ],
      createdAt: { gte: new Date(now.getTime() - 90 * DAY_MS) },
      AND: [{ OR: [{ providerCheckedAt: null }, { providerCheckedAt: { lt: new Date(now.getTime() - HOUR_MS) } }] }],
    },
    orderBy: [{ providerCheckedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: limit,
    select: { id: true },
  });

  let checked = 0;
  let failed = 0;
  for (const candidate of candidates) {
    if (Date.now() > deadline) return { checked, failed, skippedForTime: true };
    // Marca ANTES de conferir: se esta der erro, a próxima rodada começa pelas outras (senão uma
    // cobrança com problema ficaria sempre na frente da fila).
    await prisma.payment.update({ where: { id: candidate.id }, data: { providerCheckedAt: now } });
    try {
      await syncPaymentWithProvider(candidate.id, now);
      checked += 1;
    } catch (error) {
      failed += 1;
      console.error(`[conferência automática] Falha ao conferir a cobrança ${candidate.id}:`, error);
    }
  }
  return { checked, failed, skippedForTime: false };
}
