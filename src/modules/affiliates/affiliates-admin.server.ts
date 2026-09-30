/**
 * affiliates-admin.server.ts — Afiliados no painel (só ADMIN): cadastrar, editar, listar e registrar
 * o pagamento das comissões.
 *
 * Quem chama: as ações de `actions.ts` e as páginas /admin/vendas/afiliados. Os testes chamam direto.
 *
 * Regras:
 *  - Afiliado é uma pessoa com conta no site (buscada pelo e-mail), uma vez só.
 *  - O código do link não muda depois de criado (os links já foram divulgados).
 *  - Afiliado não se apaga (as vendas guardam quem indicou): desativar para de atribuir vendas
 *    NOVAS; as já feitas (e as renovações de assinaturas já indicadas) continuam gerando comissão.
 *  - Pagamento de comissões: o admin paga fora do site (ex.: Pix) e registra aqui. O registro
 *    leva TODAS as comissões liberadas naquele momento e cada cobrança só entra em um pagamento.
 */
import "server-only";

import { isUniqueViolation } from "@/lib/db-errors";
import { withAdvisoryLock } from "@/lib/db-locks";
import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";

import { listAffiliateCommissions } from "./affiliates.server";
import { summarizeCommissions } from "./rules";

/** Os afiliados com as somas das comissões (o painel mostra o que está liberado para pagar). */
export async function listAffiliatesForAdmin(now: Date = new Date()) {
  const affiliates = await prisma.affiliate.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: { id: true, code: true, commissionBps: true, isActive: true, user: { select: { name: true, email: true } } },
  });
  // Uma consulta por afiliado: suficiente para dezenas de afiliados (rever com centenas).
  return Promise.all(
    affiliates.map(async (affiliate) => ({
      ...affiliate,
      totals: summarizeCommissions(await listAffiliateCommissions(prisma, affiliate.id, now)),
    })),
  );
}

export async function createAffiliate(input: { email: string; code: string; commissionBps: number; payoutInfo: string }): Promise<{ id: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (!user) throw new UserFacingError("Nenhuma conta com este e-mail. A pessoa precisa se cadastrar no site antes.", { field: "email" });
  try {
    return await prisma.affiliate.create({
      data: { userId: user.id, code: input.code, commissionBps: input.commissionBps, payoutInfo: input.payoutInfo },
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await prisma.affiliate.findUnique({ where: { userId: user.id }, select: { id: true } });
      throw existing
        ? new UserFacingError("Esta pessoa já é afiliada.", { field: "email" })
        : new UserFacingError("Este código já é de outro afiliado.", { field: "code" });
    }
    throw error;
  }
}

/** Comissão (só vale para vendas NOVAS), como receber e se está ativo. */
export async function updateAffiliate(input: { affiliateId: string; commissionBps: number; payoutInfo: string; isActive: boolean }): Promise<void> {
  const { count } = await prisma.affiliate.updateMany({
    where: { id: input.affiliateId },
    data: { commissionBps: input.commissionBps, payoutInfo: input.payoutInfo, isActive: input.isActive },
  });
  if (count === 0) throw new UserFacingError("Afiliado não encontrado.");
}

/**
 * Registra o pagamento das comissões LIBERADAS de um afiliado.
 * Passos (com a trava do afiliado — dois cliques não registram dois pagamentos):
 *  1. Calcula as comissões e pega as liberadas (depois dos 7 dias, sem estorno, ainda não pagas).
 *  2. Nenhuma (ou soma zero) → recusa.
 *  3. Grava o pagamento e um item por cobrança (a chave única garante: cada cobrança uma vez só).
 */
export async function registerAffiliatePayout(input: {
  affiliateId: string;
  adminId: string;
  note: string;
  now?: Date;
}): Promise<{ payoutId: string; amountCents: number; count: number }> {
  const now = input.now ?? new Date();
  return withAdvisoryLock(prisma, `affiliate-payout:${input.affiliateId}`, async (tx) => {
    const affiliate = await tx.affiliate.findUnique({ where: { id: input.affiliateId }, select: { id: true } });
    if (!affiliate) throw new UserFacingError("Afiliado não encontrado.");
    const available = (await listAffiliateCommissions(tx, input.affiliateId, now)).filter((row) => row.status === "AVAILABLE");
    const amountCents = available.reduce((sum, row) => sum + row.amountCents, 0);
    if (available.length === 0 || amountCents <= 0) throw new UserFacingError("Não há comissões liberadas para pagar agora.");
    const payout = await tx.affiliatePayout.create({
      data: {
        affiliateId: input.affiliateId,
        amountCents,
        note: input.note,
        createdById: input.adminId,
        items: { create: available.map((row) => ({ paymentId: row.paymentId, amountCents: row.amountCents })) },
      },
      select: { id: true },
    });
    return { payoutId: payout.id, amountCents, count: available.length };
  });
}
