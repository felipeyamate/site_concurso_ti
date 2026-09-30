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
 * Quais cobranças: aguardando pagamento, vencidas e com estorno em andamento, dos últimos 90 dias —
 * começando pelas que estão há mais tempo sem conferir, no máximo `limit` por rodada e parando antes
 * do tempo limite da função. Cada cobrança é conferida de novo depois de 1 hora (vencida há mais de
 * 7 dias: depois de 1 dia).
 */
import "server-only";

import type { PaymentProviderKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

import { syncPaymentWithProvider } from "./admin/sales-admin.server";
import { addDays, dateOnlyToUtc, toSaoPauloDate } from "./dates";
import { getProviderForRecord } from "./provider/provider.server";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Vencida há até estes dias (de Brasília): conferida de hora em hora, como as em aberto. Cobre a
// tolerância da assinatura (5 dias), período em que o aluno mais paga atrasado. Depois disso, 1 vez por dia.
const RECENTLY_OVERDUE_DAYS = 7;
// Tempo máximo para COMEÇAR a conferir mais uma cobrança. A rota tem 60 s (`maxDuration`) e uma
// conferência pode levar ~30 s no pior caso (consulta ao provedor + nota fiscal/cancelamento, até
// 15 s cada): parar de começar aos 20 s deixa folga para a última terminar.
const DEFAULT_TIME_BUDGET_MS = 20_000;

export type ReconcileResult = { checked: number; failed: number; skippedForTime: boolean };

export async function reconcileOpenPayments(input: { now?: Date; limit?: number; timeBudgetMs?: number } = {}): Promise<ReconcileResult> {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 25;
  const deadline = Date.now() + (input.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS);
  // Só os provedores que funcionam agora: em produção, o Asaas. O simulado entra fora de produção
  // (é assim que os testes exercitam a tarefa); na página de simulação, a consulta dele é recusada.
  const providers = (["ASAAS", "FAKE"] as const).filter((kind): kind is PaymentProviderKind => getProviderForRecord(kind) !== null);
  if (providers.length === 0) return { checked: 0, failed: 0, skippedForTime: false };

  // "Não conferida há pelo menos `ms`" (ou nunca conferida).
  const notCheckedFor = (ms: number) => ({ OR: [{ providerCheckedAt: null }, { providerCheckedAt: { lt: new Date(now.getTime() - ms) } }] });
  // A coluna `dueDate` é uma data (sem hora): o corte é pelo dia de Brasília.
  const recentlyOverdueSince = dateOnlyToUtc(addDays(toSaoPauloDate(now), -RECENTLY_OVERDUE_DAYS));
  const candidates = await prisma.payment.findMany({
    where: {
      provider: { in: providers },
      createdAt: { gte: new Date(now.getTime() - 90 * DAY_MS) },
      // Toda cobrança vencida ainda pode ser paga (o site mostra "Pagar"), então nenhuma sai da lista.
      // Mas as vencidas há mais de 7 dias (quase sempre um Pix abandonado) são conferidas 1 vez por
      // dia: senão ocupariam, de hora em hora, as 25 vagas de cada rodada no lugar das que importam.
      OR: [
        { AND: [{ status: { in: ["PENDING", "REFUND_REQUESTED"] } }, notCheckedFor(HOUR_MS)] },
        { AND: [{ status: "OVERDUE", dueDate: { gte: recentlyOverdueSince } }, notCheckedFor(HOUR_MS)] },
        { AND: [{ status: "OVERDUE", dueDate: { lt: recentlyOverdueSince } }, notCheckedFor(DAY_MS)] },
      ],
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
