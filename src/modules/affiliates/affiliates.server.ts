/**
 * affiliates.server.ts — Afiliados no banco: achar pelo código, contar cliques e as comissões.
 *
 * Quem chama: o link de divulgação (`src/app/r/[code]/route.ts`), o checkout (quem fica com a
 * venda), a área do afiliado e o painel de vendas. As regras ficam em `rules.ts` (arquivo puro).
 *
 * Comissões não têm tabela própria: são CALCULADAS a partir das cobranças dos pedidos/assinaturas
 * do afiliado (valor pago × comissão guardada no pedido). Assim um estorno cancela a comissão
 * sozinho, sem ninguém precisar lembrar de atualizar nada. Só o PAGAMENTO ao afiliado é gravado
 * (`affiliate_payouts`), e cada cobrança entra em no máximo um pagamento.
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";
import { addDays, dateOnlyToUtc, toSaoPauloDate } from "@/modules/payments/dates";

import {
  commissionCents,
  commissionReleaseDate,
  commissionStatus,
  isValidAffiliateCode,
  normalizeAffiliateCode,
  resolveAttribution,
  summarizeCommissions,
  type AffiliateRef,
  type CommissionStatus,
} from "./rules";

type Db = Prisma.TransactionClient;

const affiliateRefSelect = { id: true, userId: true, commissionBps: true, isActive: true } as const satisfies Prisma.AffiliateSelect;

/** O afiliado pelo código do link (qualquer situação — quem chama confere se está ativo). */
export async function findAffiliateByCode(db: Db, code: string): Promise<AffiliateRef | null> {
  return db.affiliate.findUnique({ where: { code: normalizeAffiliateCode(code) }, select: affiliateRefSelect });
}

/**
 * Soma 1 clique no dia (de Brasília) do afiliado. Um único comando ("insere ou soma"), então
 * cliques ao mesmo tempo não se perdem. Paralelo em SQL: INSERT ... ON CONFLICT DO UPDATE.
 */
export async function recordAffiliateClick(affiliateId: string, now: Date = new Date()): Promise<void> {
  const day = dateOnlyToUtc(toSaoPauloDate(now));
  await prisma.affiliateClickDay.upsert({
    where: { affiliateId_day: { affiliateId, day } },
    create: { affiliateId, day, clicks: 1 },
    update: { clicks: { increment: 1 } },
  });
}

/**
 * Quem fica com a venda (ver `resolveAttribution`): o afiliado do cupom, ou o do link (código
 * guardado no cookie). Chamado dentro da transação que cria o pedido/assinatura.
 */
export async function resolveSaleAttribution(
  db: Db,
  input: { couponAffiliate: AffiliateRef | null; affiliateCode: string | null | undefined; buyerId: string },
): Promise<{ affiliateId: string; commissionBps: number } | null> {
  const code = input.affiliateCode ? normalizeAffiliateCode(input.affiliateCode) : null;
  const linkAffiliate = code && isValidAffiliateCode(code) ? await findAffiliateByCode(db, code) : null;
  return resolveAttribution({ couponAffiliate: input.couponAffiliate, linkAffiliate, buyerId: input.buyerId });
}

export type CommissionRow = {
  paymentId: string;
  // O que foi vendido ("Curso Base — 12 meses" / "Assinatura mensal (assinatura)").
  description: string;
  paidAt: Date | null;
  valueCents: number;
  amountCents: number;
  status: CommissionStatus;
  refundedAfterPayout: boolean;
  releaseDate: Date | null;
};

/**
 * As comissões de VÁRIOS afiliados de uma vez (uma consulta só, para a lista do painel): para cada
 * afiliado, uma comissão por cobrança paga (ou estornada depois de paga) dos pedidos e assinaturas
 * dele, da mais nova para a mais antiga.
 * Valor: o que foi PAGO × a comissão guardada no pedido/assinatura; se já entrou num pagamento
 * ao afiliado, vale o valor registrado nele.
 */
export async function listCommissionsByAffiliate(db: Db, affiliateIds: string[], now: Date): Promise<Map<string, CommissionRow[]>> {
  const byAffiliate = new Map<string, CommissionRow[]>(affiliateIds.map((id) => [id, []]));
  if (affiliateIds.length === 0) return byAffiliate;
  const payments = await db.payment.findMany({
    where: {
      OR: [{ order: { affiliateId: { in: affiliateIds } } }, { subscription: { affiliateId: { in: affiliateIds } } }],
      NOT: { status: { in: ["PENDING", "OVERDUE"] } },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      paidAt: true,
      valueCents: true,
      order: { select: { productTitle: true, affiliateId: true, affiliateCommissionBps: true } },
      subscription: { select: { planTitle: true, affiliateId: true, affiliateCommissionBps: true } },
      affiliatePayoutItem: { select: { amountCents: true } },
    },
  });
  for (const payment of payments) {
    const affiliateId = payment.order?.affiliateId ?? payment.subscription?.affiliateId;
    const rows = affiliateId ? byAffiliate.get(affiliateId) : undefined;
    if (!rows) continue;
    const situation = commissionStatus({ paymentStatus: payment.status, paidAt: payment.paidAt, paidOut: Boolean(payment.affiliatePayoutItem), now });
    if (!situation) continue;
    const bps = payment.order?.affiliateCommissionBps ?? payment.subscription?.affiliateCommissionBps ?? 0;
    rows.push({
      paymentId: payment.id,
      description: payment.order ? payment.order.productTitle : `${payment.subscription?.planTitle ?? "Assinatura"} (assinatura)`,
      paidAt: payment.paidAt,
      valueCents: payment.valueCents,
      amountCents: payment.affiliatePayoutItem?.amountCents ?? commissionCents(payment.valueCents, bps),
      status: situation.status,
      refundedAfterPayout: situation.refundedAfterPayout,
      releaseDate: payment.paidAt ? commissionReleaseDate(payment.paidAt) : null,
    });
  }
  return byAffiliate;
}

/** As comissões de um afiliado (ver `listCommissionsByAffiliate`). */
export async function listAffiliateCommissions(db: Db, affiliateId: string, now: Date): Promise<CommissionRow[]> {
  return (await listCommissionsByAffiliate(db, [affiliateId], now)).get(affiliateId) ?? [];
}

/** Cliques nos últimos 30 dias (contando hoje). */
async function clicksLast30Days(affiliateId: string, now: Date): Promise<number> {
  const since = dateOnlyToUtc(addDays(toSaoPauloDate(now), -29));
  const result = await prisma.affiliateClickDay.aggregate({ where: { affiliateId, day: { gte: since } }, _sum: { clicks: true } });
  return result._sum.clicks ?? 0;
}

/**
 * Tudo o que a área do afiliado (e a ficha dele no painel) mostra: cadastro, cliques, vendas,
 * comissões (lista e somas por situação) e os pagamentos já recebidos.
 * Sem dados de quem comprou (LGPD): o afiliado vê o que foi vendido, quando e quanto.
 */
async function buildAffiliateReport(affiliate: { id: string }, now: Date) {
  const [commissions, clicks, orders, subscriptions, payouts] = await Promise.all([
    listAffiliateCommissions(prisma, affiliate.id, now),
    clicksLast30Days(affiliate.id, now),
    // "Vendas" = pedidos pagos (mesmo que depois estornados) e assinaturas com algum ciclo pago.
    prisma.order.count({ where: { affiliateId: affiliate.id, status: { in: ["PAID", "REFUND_REQUESTED", "REFUNDED", "CHARGEBACK"] } } }),
    prisma.subscription.count({ where: { affiliateId: affiliate.id, payments: { some: { paidAt: { not: null } } } } }),
    prisma.affiliatePayout.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, amountCents: true, note: true, createdAt: true, _count: { select: { items: true } } },
    }),
  ]);
  return { commissions, totals: summarizeCommissions(commissions), clicks30Days: clicks, sales: orders + subscriptions, payouts };
}

const affiliateProfileSelect = {
  id: true,
  code: true,
  commissionBps: true,
  payoutInfo: true,
  isActive: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const satisfies Prisma.AffiliateSelect;

/** Área do afiliado: o relatório de quem está logado (null = a pessoa não é afiliada). */
export async function getAffiliateDashboard(userId: string, now: Date = new Date()) {
  const affiliate = await prisma.affiliate.findUnique({ where: { userId }, select: affiliateProfileSelect });
  if (!affiliate) return null;
  return { affiliate, ...(await buildAffiliateReport(affiliate, now)) };
}

/** Painel: o relatório de um afiliado. */
export async function getAffiliateForAdmin(affiliateId: string, now: Date = new Date()) {
  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId }, select: affiliateProfileSelect });
  if (!affiliate) return null;
  return { affiliate, ...(await buildAffiliateReport(affiliate, now)) };
}

/** A própria pessoa afiliada troca "como receber" (ex.: a chave Pix). */
export async function updateOwnPayoutInfo(userId: string, payoutInfo: string): Promise<void> {
  const { count } = await prisma.affiliate.updateMany({ where: { userId }, data: { payoutInfo } });
  if (count === 0) throw new UserFacingError("Você não está no programa de afiliados.");
}
