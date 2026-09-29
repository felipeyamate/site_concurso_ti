/**
 * labels.ts — Textos em português para as situações de vendas (mostrados nas telas).
 *
 * Quem chama: "Minhas compras", a página de pagamento e o painel de vendas.
 * Arquivo "puro": pode ser usado tanto no servidor quanto no navegador.
 */
import type {
  FiscalInvoiceStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PlanCycle,
  SubscriptionStatus,
} from "@/generated/prisma/enums";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Aguardando pagamento",
  OVERDUE: "Vencido",
  PAID: "Pago",
  REFUND_REQUESTED: "Reembolso em andamento",
  REFUNDED: "Reembolsado",
  CHARGEBACK: "Contestado no cartão",
  CANCELED: "Cancelado",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Aguardando pagamento",
  OVERDUE: "Vencida",
  CONFIRMED: "Paga (confirmada)",
  RECEIVED: "Paga",
  REFUND_REQUESTED: "Estorno em andamento",
  REFUNDED: "Estornada",
  CHARGEBACK: "Contestada no cartão",
  CANCELED: "Cancelada",
};

export const PLAN_CYCLE_LABELS: Record<PlanCycle, string> = {
  MONTHLY: "Mensal",
  YEARLY: "Anual",
};

// "R$ 49,90 por mês" / "por ano".
export const PLAN_CYCLE_PERIOD: Record<PlanCycle, string> = {
  MONTHLY: "por mês",
  YEARLY: "por ano",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  PENDING: "Aguardando o 1º pagamento",
  ACTIVE: "Ativa",
  CANCELED: "Cancelada",
};

export const FISCAL_INVOICE_STATUS_LABELS: Record<FiscalInvoiceStatus, string> = {
  PENDING: "Aguardando emissão",
  SCHEDULED: "Agendada",
  AUTHORIZED: "Emitida",
  PROCESSING_CANCELLATION: "Cancelamento em andamento",
  CANCELED: "Cancelada",
  CANCELLATION_DENIED: "Cancelamento recusado",
  ERROR: "Erro na emissão",
};

/** Quanto tempo de acesso, em palavras: null → "sem data de fim"; 365 → "1 ano"; 90 → "90 dias". */
export function accessDaysLabel(days: number | null): string {
  if (days === null) return "sem data de fim";
  if (days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? "1 ano" : `${years} anos`;
  }
  return days === 1 ? "1 dia" : `${days} dias`;
}
