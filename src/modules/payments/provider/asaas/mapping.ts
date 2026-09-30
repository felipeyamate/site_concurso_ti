/**
 * mapping.ts — Tradução entre o formato do Asaas e o nosso (status, cobranças, avisos).
 *
 * Quem chama: o provedor Asaas (`asaas-provider.ts`, respostas da API) e o recebimento dos
 * avisos (`webhook.server.ts`). O provedor SIMULADO também gera avisos neste formato, para que o
 * desenvolvimento use exatamente o mesmo caminho da produção.
 *
 * Arquivo "puro" (sem rede), testado em `mapping.test.ts`.
 * Referência: documentação da API v3 do Asaas (cobranças, webhooks, notas fiscais).
 */
import { z } from "zod";

import type { FiscalInvoiceStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";

import type { DateOnly } from "../../dates";
import { reaisToCents } from "../../money";
import type { ProviderCharge, ProviderInvoice } from "../types";

// -------------------------------------------------------------------------------------------
// Status
// -------------------------------------------------------------------------------------------

// Status do Asaas → o nosso (mais simples). Status desconhecidos viram PENDING (e o original
// fica guardado em `providerStatus`, para conferência).
const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  PENDING: "PENDING",
  AWAITING_RISK_ANALYSIS: "PENDING",
  CONFIRMED: "CONFIRMED",
  RECEIVED: "RECEIVED",
  RECEIVED_IN_CASH: "RECEIVED",
  DUNNING_RECEIVED: "RECEIVED",
  OVERDUE: "OVERDUE",
  DUNNING_REQUESTED: "OVERDUE",
  REFUND_REQUESTED: "REFUND_REQUESTED",
  REFUND_IN_PROGRESS: "REFUND_REQUESTED",
  REFUNDED: "REFUNDED",
  CHARGEBACK_REQUESTED: "CHARGEBACK",
  CHARGEBACK_DISPUTE: "CHARGEBACK",
  AWAITING_CHARGEBACK_REVERSAL: "CHARGEBACK",
  DELETED: "CANCELED",
};

// Avisos que, por si só, dizem que a cobrança deixou de existir.
const CANCELING_EVENTS = new Set(["PAYMENT_DELETED", "PAYMENT_BANK_SLIP_CANCELLED"]);

export function mapAsaasPaymentStatus(input: {
  status: string | null | undefined;
  deleted?: boolean | null;
  event?: string;
}): PaymentStatus {
  if (input.deleted || (input.event && CANCELING_EVENTS.has(input.event))) return "CANCELED";
  return PAYMENT_STATUS_MAP[input.status ?? ""] ?? "PENDING";
}

const BILLING_TYPE_MAP: Record<string, PaymentMethod> = {
  PIX: "PIX",
  BOLETO: "BOLETO",
  CREDIT_CARD: "CREDIT_CARD",
  DEBIT_CARD: "CREDIT_CARD",
};

export function mapAsaasBillingType(billingType: string | null | undefined): PaymentMethod | null {
  return BILLING_TYPE_MAP[billingType ?? ""] ?? null;
}

const INVOICE_STATUS_MAP: Record<string, FiscalInvoiceStatus> = {
  SCHEDULED: "SCHEDULED",
  SYNCHRONIZED: "SCHEDULED",
  AUTHORIZATION_PENDING: "SCHEDULED",
  AUTHORIZED: "AUTHORIZED",
  PROCESSING_CANCELLATION: "PROCESSING_CANCELLATION",
  CANCELED: "CANCELED",
  CANCELLATION_DENIED: "CANCELLATION_DENIED",
  ERROR: "ERROR",
};

export function mapAsaasInvoiceStatus(status: string | null | undefined): FiscalInvoiceStatus {
  return INVOICE_STATUS_MAP[status ?? ""] ?? "SCHEDULED";
}

// -------------------------------------------------------------------------------------------
// Objetos do Asaas (só os campos que usamos; o resto é ignorado — `passthrough` não é preciso)
// -------------------------------------------------------------------------------------------

const optionalText = z.string().nullish();

export const asaasPaymentSchema = z.object({
  id: z.string().min(1),
  subscription: optionalText,
  installment: optionalText,
  installmentNumber: z.number().int().nullish(),
  externalReference: optionalText,
  billingType: optionalText,
  status: optionalText,
  value: z.number().nullish(),
  dueDate: optionalText,
  invoiceUrl: optionalText,
  bankSlipUrl: optionalText,
  deleted: z.boolean().nullish(),
});
export type AsaasPayment = z.infer<typeof asaasPaymentSchema>;

export const asaasInvoiceSchema = z.object({
  id: z.string().min(1),
  payment: optionalText,
  status: optionalText,
  statusDescription: optionalText,
  number: optionalText,
  pdfUrl: optionalText,
  xmlUrl: optionalText,
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Cobrança do Asaas → a nossa `ProviderCharge`. */
export function toProviderCharge(payment: AsaasPayment, event?: string): ProviderCharge {
  return {
    paymentId: payment.id,
    installmentId: payment.installment ?? null,
    subscriptionId: payment.subscription ?? null,
    externalReference: payment.externalReference ?? null,
    method: mapAsaasBillingType(payment.billingType),
    status: mapAsaasPaymentStatus({ status: payment.status, deleted: payment.deleted, event }),
    providerStatus: payment.deleted ? "DELETED" : (payment.status ?? "UNKNOWN"),
    valueCents: payment.value != null ? reaisToCents(payment.value) : 0,
    dueDate: payment.dueDate && DATE_ONLY.test(payment.dueDate) ? (payment.dueDate as DateOnly) : null,
    installmentNumber: payment.installmentNumber ?? null,
    invoiceUrl: payment.invoiceUrl ?? null,
    bankSlipUrl: payment.bankSlipUrl ?? null,
  };
}

/** Nota fiscal do Asaas → a nossa `ProviderInvoice`. */
export function toProviderInvoice(invoice: z.infer<typeof asaasInvoiceSchema>): ProviderInvoice {
  return {
    invoiceId: invoice.id,
    status: mapAsaasInvoiceStatus(invoice.status),
    number: invoice.number ?? null,
    pdfUrl: invoice.pdfUrl ?? null,
    xmlUrl: invoice.xmlUrl ?? null,
    statusDescription: invoice.statusDescription ?? null,
  };
}

// -------------------------------------------------------------------------------------------
// Avisos (webhooks)
// -------------------------------------------------------------------------------------------

// Envelope comum a todo aviso: { id: "evt_...", event: "PAYMENT_RECEIVED", dateCreated, ... }.
const webhookEnvelopeSchema = z.object({
  id: z.string().min(1).max(300),
  event: z.string().min(1).max(100),
  dateCreated: optionalText,
  payment: z.unknown().optional(),
  invoice: z.unknown().optional(),
  subscription: z.unknown().optional(),
});

const asaasSubscriptionEventSchema = z.object({
  id: z.string().min(1),
  status: optionalText,
  deleted: z.boolean().nullish(),
});

// Data/hora do aviso no formato do Asaas ("2026-09-29 10:00:00", horário de Brasília).
const EVENT_DATE_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export type ParsedWebhook =
  | { kind: "payment"; eventId: string; type: string; occurredAt: string | null; charge: ProviderCharge }
  | { kind: "invoice"; eventId: string; type: string; occurredAt: string | null; invoice: ProviderInvoice }
  | {
      kind: "subscription";
      eventId: string;
      type: string;
      occurredAt: string | null;
      subscription: { id: string; ended: boolean };
    }
  | { kind: "other"; eventId: string; type: string; occurredAt: string | null };

export type ParseWebhookResult = { ok: true; webhook: ParsedWebhook } | { ok: false; error: string };

// Só o mínimo para GUARDAR o aviso: o ID (evita processar duas vezes) e o tipo.
const minimalEnvelopeSchema = z.object({ id: z.string().min(1).max(300), event: z.string().min(1).max(100) });

/**
 * Lê só o "envelope" do aviso (ID e tipo). É o que a rota confere ANTES de gravar: um aviso com
 * ID e tipo é sempre guardado, mesmo que o resto venha num formato inesperado (aí o erro fica
 * registrado no próprio aviso, para corrigir e reprocessar pelo painel). Sem ID nem tipo, não é
 * um aviso do Asaas.
 */
export function parseAsaasEnvelope(body: unknown): { ok: true; eventId: string; type: string } | { ok: false; error: string } {
  const envelope = minimalEnvelopeSchema.safeParse(body);
  if (!envelope.success) return { ok: false, error: "Aviso sem ID ou sem tipo de evento." };
  return { ok: true, eventId: envelope.data.id, type: envelope.data.event };
}

/**
 * Lê e confere um aviso do Asaas (o corpo JSON já convertido em objeto).
 *
 * Passos:
 *  1. Confere o envelope (ID do evento e tipo são obrigatórios).
 *  2. Conforme o tipo (PAYMENT_*, INVOICE_*, SUBSCRIPTION_*), confere o objeto correspondente e o
 *     traduz para o nosso formato.
 *  3. Outros tipos: "other" (guardamos o aviso, mas não há nada a fazer).
 */
export function parseAsaasWebhook(body: unknown): ParseWebhookResult {
  const envelope = webhookEnvelopeSchema.safeParse(body);
  if (!envelope.success) return { ok: false, error: "Aviso sem ID ou sem tipo de evento." };
  const { id: eventId, event: type } = envelope.data;
  const occurredAt =
    envelope.data.dateCreated && EVENT_DATE_TIME.test(envelope.data.dateCreated) ? envelope.data.dateCreated : null;
  const base = { eventId, type, occurredAt };

  if (type.startsWith("PAYMENT_")) {
    const payment = asaasPaymentSchema.safeParse(envelope.data.payment);
    if (!payment.success) return { ok: false, error: `Aviso ${type} sem os dados da cobrança.` };
    return { ok: true, webhook: { kind: "payment", ...base, charge: toProviderCharge(payment.data, type) } };
  }
  if (type.startsWith("INVOICE_")) {
    const invoice = asaasInvoiceSchema.safeParse(envelope.data.invoice);
    if (!invoice.success) return { ok: false, error: `Aviso ${type} sem os dados da nota fiscal.` };
    return { ok: true, webhook: { kind: "invoice", ...base, invoice: toProviderInvoice(invoice.data) } };
  }
  if (type.startsWith("SUBSCRIPTION_")) {
    const subscription = asaasSubscriptionEventSchema.safeParse(envelope.data.subscription);
    if (!subscription.success) return { ok: false, error: `Aviso ${type} sem os dados da assinatura.` };
    // Assinatura removida ou inativada no Asaas = não gera mais cobranças (cancelada).
    const ended =
      type === "SUBSCRIPTION_DELETED" ||
      type === "SUBSCRIPTION_INACTIVATED" ||
      Boolean(subscription.data.deleted) ||
      subscription.data.status === "INACTIVE" ||
      subscription.data.status === "EXPIRED";
    return { ok: true, webhook: { kind: "subscription", ...base, subscription: { id: subscription.data.id, ended } } };
  }
  return { ok: true, webhook: { kind: "other", ...base } };
}

/** "2026-09-29 10:00:00" (Brasília) → Date. */
export function eventTimeToDate(occurredAt: string): Date {
  return new Date(`${occurredAt.replace(" ", "T")}-03:00`);
}

const saoPauloDateTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Date → "2026-09-29 10:00:00" (Brasília), o mesmo formato dos avisos do Asaas. */
export function dateToEventTime(date: Date): string {
  // "sv-SE" (sueco) formata como "2026-09-29 10:00:00" — exatamente o formato que queremos.
  return saoPauloDateTimeFormatter.format(date);
}
