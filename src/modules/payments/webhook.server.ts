/**
 * webhook.server.ts — Recebe e processa os AVISOS (webhooks) do provedor de pagamento.
 *
 * Quem chama: a rota `/api/webhooks/asaas` (avisos reais, depois de conferir o token), a página
 * de simulação `/dev/pagamentos` (avisos simulados) e o painel ("Reprocessar").
 *
 * REGRAS QUE NÃO MUDAM (PROJECT.md, seção 6):
 *  - Todo aviso é gravado em `WebhookEvent` ANTES de ser processado; o ID do evento é único →
 *    o mesmo aviso chegando duas vezes não é processado de novo ("idempotência").
 *  - Um aviso que dá erro fica gravado com o erro, para investigar e reprocessar pelo painel.
 *    A rota responde "recebido" mesmo assim: se respondêssemos erro, o Asaas reenviaria e, depois
 *    de várias falhas, PAUSARIA a fila inteira — travando os pagamentos de todo mundo por causa
 *    de um aviso só.
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { PaymentProviderKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db-errors";

import { applyChargeUpdate } from "./charges.server";
import { runEffects, type PaymentEffect } from "./effects.server";
import { applyInvoiceUpdate } from "./fiscal.server";
import { parseAsaasWebhook, type ParsedWebhook } from "./provider/asaas/mapping";

export type WebhookOutcome =
  | { status: "processed"; eventRowId: string; note: string }
  | { status: "duplicate"; eventRowId: string }
  | { status: "failed"; eventRowId: string; error: string };

export type ReceiveWebhookResult = { ok: true; outcome: WebhookOutcome } | { ok: false; error: string };

/**
 * Recebe um aviso: confere o formato, grava (uma vez só) e processa.
 * `body` = o JSON do aviso já convertido em objeto.
 */
export async function receiveWebhook(params: {
  provider: PaymentProviderKind;
  body: unknown;
  now?: Date;
}): Promise<ReceiveWebhookResult> {
  const parsed = parseAsaasWebhook(params.body);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { eventId, type } = parsed.webhook;

  let eventRowId: string;
  try {
    const row = await prisma.webhookEvent.create({
      data: { provider: params.provider, eventId, type, payload: params.body as Prisma.InputJsonValue },
      select: { id: true },
    });
    eventRowId = row.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Já recebido antes. Se já foi processado com sucesso, não faz nada; se deu erro, tenta de novo.
    const existing = await prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_eventId: { provider: params.provider, eventId } },
      select: { id: true, processedAt: true },
    });
    if (existing.processedAt) return { ok: true, outcome: { status: "duplicate", eventRowId: existing.id } };
    eventRowId = existing.id;
  }

  return { ok: true, outcome: await processWebhookEvent(eventRowId, params.now) };
}

async function applyWebhook(
  provider: PaymentProviderKind,
  webhook: ParsedWebhook,
  now: Date,
): Promise<{ note: string; effects: PaymentEffect[] }> {
  switch (webhook.kind) {
    case "payment": {
      const result = await applyChargeUpdate({
        provider,
        charge: webhook.charge,
        occurredAt: webhook.occurredAt,
        mode: "event",
        now,
      });
      return { note: result.note, effects: result.effects };
    }
    case "invoice":
      return { note: await applyInvoiceUpdate(webhook.invoice), effects: [] };
    case "subscription": {
      if (!webhook.subscription.ended) return { note: "Assinatura atualizada no provedor.", effects: [] };
      // Removida/inativada no provedor (ex.: pelo painel do Asaas): não gera mais cobranças.
      // O período já pago continua valendo (o acesso não muda aqui).
      const { count } = await prisma.subscription.updateMany({
        where: { provider, providerSubscriptionId: webhook.subscription.id, status: { not: "CANCELED" } },
        data: { status: "CANCELED", canceledAt: now },
      });
      return { note: count > 0 ? "Assinatura cancelada no provedor." : "Assinatura já cancelada (ou de fora do site).", effects: [] };
    }
    case "other":
      return { note: `Tipo de aviso não usado pelo site (${webhook.type}).`, effects: [] };
  }
}

/** Processa (ou reprocessa) um aviso já gravado. Erros ficam registrados no próprio aviso. */
export async function processWebhookEvent(eventRowId: string, now: Date = new Date()): Promise<WebhookOutcome> {
  const row = await prisma.webhookEvent.findUniqueOrThrow({
    where: { id: eventRowId },
    select: { id: true, provider: true, payload: true },
  });

  try {
    const parsed = parseAsaasWebhook(row.payload);
    if (!parsed.ok) throw new Error(parsed.error);
    const { note, effects } = await applyWebhook(row.provider, parsed.webhook, now);
    await prisma.webhookEvent.update({
      where: { id: row.id },
      data: { processedAt: now, note, error: null, attempts: { increment: 1 } },
    });
    await runEffects(effects);
    return { status: "processed", eventRowId: row.id, note };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
    console.error(`[webhook] Falha ao processar o aviso ${row.id}:`, error);
    await prisma.webhookEvent.update({
      where: { id: row.id },
      data: { error: message, attempts: { increment: 1 } },
    });
    return { status: "failed", eventRowId: row.id, error: message };
  }
}
