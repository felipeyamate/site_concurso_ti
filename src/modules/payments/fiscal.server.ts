/**
 * fiscal.server.ts — Nota fiscal de serviço (NFS-e) das cobranças pagas, emitida pelo provedor.
 *
 * Quem chama: `effects.server.ts` (depois que um pagamento é confirmado ou estornado), o
 * processamento dos avisos INVOICE_* e o painel ("Tentar emitir de novo").
 *
 * Liga com NFSE_ENABLED=true (e os dados fiscais nas variáveis NFSE_*). Desligada: nada acontece.
 *
 * Cuidados:
 *  - NUNCA duas notas para a mesma cobrança: uma trava por cobrança + a nota só é pedida se ainda
 *    não foi (ou se a anterior deu erro na prefeitura).
 *  - Reembolso/contestação → pede o cancelamento da nota.
 */
import "server-only";

import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { advisoryLock } from "@/lib/db-locks";

import { toSaoPauloDate } from "./dates";
import { getProviderForRecord } from "./provider/provider.server";
import type { ProviderInvoice } from "./provider/types";
import { isPaidStatus } from "./rules";

export type FiscalConfig = {
  serviceDescription: string;
  municipalServiceId: string | null;
  municipalServiceCode: string | null;
  municipalServiceName: string;
  issRate: number;
};

/** Configuração da NFS-e, ou `null` se estiver desligada. */
export function getFiscalConfig(): FiscalConfig | null {
  if (env.NFSE_ENABLED !== "true") return null;
  // O env-schema já garante que estes campos existem quando NFSE_ENABLED=true.
  return {
    serviceDescription: env.NFSE_SERVICE_DESCRIPTION ?? "",
    municipalServiceId: env.NFSE_MUNICIPAL_SERVICE_ID ?? null,
    municipalServiceCode: env.NFSE_MUNICIPAL_SERVICE_CODE ?? null,
    municipalServiceName: env.NFSE_MUNICIPAL_SERVICE_NAME ?? "",
    issRate: env.NFSE_ISS_RATE ?? 0,
  };
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

/**
 * Pede a nota fiscal de uma cobrança paga.
 *
 * Passos (numa transação, com a trava da cobrança — a chamada ao provedor fica DENTRO dela de
 * propósito, para que dois pedidos simultâneos nunca gerem duas notas):
 *  1. Confere se a NFS-e está ligada e se a cobrança está paga.
 *  2. Se já existe nota pedida (e não deu erro), não faz nada.
 *  3. Pede ao provedor e guarda o resultado (ou o erro, para tentar de novo pelo painel).
 */
export async function scheduleFiscalInvoice(paymentId: string, now: Date = new Date()): Promise<void> {
  const config = getFiscalConfig();
  if (!config) return;

  await prisma.$transaction(
    async (tx) => {
      await advisoryLock(tx, `fiscal:${paymentId}`);
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: {
          id: true,
          provider: true,
          providerPaymentId: true,
          status: true,
          valueCents: true,
          fiscalInvoice: { select: { providerInvoiceId: true, status: true } },
          order: { select: { id: true, productTitle: true } },
          subscription: { select: { id: true, planTitle: true } },
        },
      });
      if (!payment || !isPaidStatus(payment.status)) return;
      const existing = payment.fiscalInvoice;
      if (existing?.providerInvoiceId && existing.status !== "ERROR") return;

      await tx.fiscalInvoice.upsert({
        where: { paymentId },
        create: { paymentId, status: "PENDING" },
        update: { status: "PENDING", error: null },
      });

      const provider = getProviderForRecord(payment.provider);
      if (!provider) {
        await tx.fiscalInvoice.update({
          where: { paymentId },
          data: { error: "Provedor de pagamento indisponível para emitir a nota." },
        });
        return;
      }

      const itemTitle = payment.order?.productTitle ?? payment.subscription?.planTitle ?? "Curso online";
      const reference = payment.order ? `Pedido ${payment.order.id}` : `Assinatura ${payment.subscription?.id ?? ""}`;
      try {
        const invoice = await provider.scheduleInvoice({
          paymentId: payment.providerPaymentId,
          valueCents: payment.valueCents,
          effectiveDate: toSaoPauloDate(now),
          serviceDescription: `${config.serviceDescription} — ${itemTitle}`,
          observations: reference,
          municipalServiceId: config.municipalServiceId,
          municipalServiceCode: config.municipalServiceCode,
          municipalServiceName: config.municipalServiceName,
          issRate: config.issRate,
          externalReference: payment.id,
        });
        await tx.fiscalInvoice.update({ where: { paymentId }, data: invoiceData(invoice) });
      } catch (error) {
        console.error(`[nfs-e] Falha ao pedir a nota da cobrança ${paymentId}:`, error);
        await tx.fiscalInvoice.update({ where: { paymentId }, data: { status: "PENDING", error: errorText(error) } });
      }
    },
    { timeout: 30_000 },
  );
}

// Dados da nota vindos do provedor → colunas da tabela.
function invoiceData(invoice: ProviderInvoice) {
  const failed = invoice.status === "ERROR" || invoice.status === "CANCELLATION_DENIED";
  return {
    providerInvoiceId: invoice.invoiceId,
    status: invoice.status,
    number: invoice.number,
    pdfUrl: invoice.pdfUrl,
    xmlUrl: invoice.xmlUrl,
    error: failed ? (invoice.statusDescription ?? "A prefeitura recusou a operação.") : null,
  };
}

/** Pede o cancelamento da nota de uma cobrança estornada/contestada (se houver nota). */
export async function cancelFiscalInvoice(paymentId: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await advisoryLock(tx, `fiscal:${paymentId}`);
      const invoice = await tx.fiscalInvoice.findUnique({
        where: { paymentId },
        select: { providerInvoiceId: true, status: true, payment: { select: { provider: true } } },
      });
      if (!invoice) return;
      // Ainda não pedida ao provedor: basta marcar como cancelada aqui.
      if (!invoice.providerInvoiceId) {
        await tx.fiscalInvoice.update({ where: { paymentId }, data: { status: "CANCELED", error: null } });
        return;
      }
      if (invoice.status !== "SCHEDULED" && invoice.status !== "AUTHORIZED") return;

      const provider = getProviderForRecord(invoice.payment.provider);
      if (!provider) return;
      try {
        await provider.cancelInvoice(invoice.providerInvoiceId);
        await tx.fiscalInvoice.update({ where: { paymentId }, data: { status: "PROCESSING_CANCELLATION", error: null } });
      } catch (error) {
        console.error(`[nfs-e] Falha ao cancelar a nota da cobrança ${paymentId}:`, error);
        await tx.fiscalInvoice.update({ where: { paymentId }, data: { error: errorText(error) } });
      }
    },
    { timeout: 30_000 },
  );
}

/** Aviso INVOICE_* do provedor: atualiza a nota (emitida, cancelada, erro...). */
export async function applyInvoiceUpdate(invoice: ProviderInvoice): Promise<string> {
  const { count } = await prisma.fiscalInvoice.updateMany({
    where: { providerInvoiceId: invoice.invoiceId },
    data: invoiceData(invoice),
  });
  return count > 0
    ? `Nota fiscal ${invoice.invoiceId}: ${invoice.status}.`
    : `Nota fiscal ${invoice.invoiceId} não é do site: ignorada.`;
}
