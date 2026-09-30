/**
 * rules.ts — Regras de negócio das vendas: vencimento, situação do pedido, reembolso (7 dias)
 * e o período que cada ciclo da assinatura libera.
 *
 * Quem chama: o checkout, o processamento dos avisos do provedor (webhook), as telas de
 * "Minhas compras" e o painel de vendas.
 *
 * Arquivo "puro" (sem banco, sem rede), testado em `rules.test.ts` — são as regras que mexem
 * com dinheiro e acesso, então cada caso tem teste.
 */
import type { OrderStatus, PaymentMethod, PaymentStatus, PlanCycle } from "@/generated/prisma/enums";

import { addDays, addMonths, endOfDayInSaoPaulo, toSaoPauloDate, type DateOnly } from "./dates";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Direito de arrependimento (Código de Defesa do Consumidor, art. 49): 7 dias após a compra.
export const REFUND_WINDOW_DAYS = 7;
// Tolerância depois do fim de um ciclo pago da assinatura, para o próximo pagamento ser
// confirmado (um boleto leva até 3 dias úteis para "cair") sem o aluno perder o acesso.
export const SUBSCRIPTION_GRACE_DAYS = 5;
// Limite de pedidos novos por aluno em 24 h (evita criar cobranças sem fim, por erro ou abuso).
export const MAX_NEW_ORDERS_PER_DAY = 10;

// Em quantos dias vence a cobrança, conforme a forma de pagamento. Boleto precisa de mais prazo
// (o aluno paga no banco); Pix e cartão são na hora.
const DUE_IN_DAYS: Record<PaymentMethod, number> = { PIX: 1, CREDIT_CARD: 1, BOLETO: 3 };

/** Data de vencimento de uma cobrança criada agora (dia de Brasília). */
export function computeDueDate(method: PaymentMethod, now: Date): DateOnly {
  return addDays(toSaoPauloDate(now), DUE_IN_DAYS[method]);
}

/** Cobrança paga (libera acesso)? CONFIRMED = cartão aprovado; RECEIVED = dinheiro recebido. */
export function isPaidStatus(status: PaymentStatus): boolean {
  return status === "CONFIRMED" || status === "RECEIVED";
}

/** Dinheiro voltando para o aluno (estorno ou contestação): o acesso daquela cobrança sai. */
export function isReversedStatus(status: PaymentStatus): boolean {
  return status === "REFUND_REQUESTED" || status === "REFUNDED" || status === "CHARGEBACK";
}

/**
 * A situação do pedido, a partir das suas cobranças (uma, ou uma por parcela no cartão).
 *
 * Ordem de prioridade (a primeira que valer):
 *  1. alguma contestação (chargeback) → CHARGEBACK;
 *  2. alguma estornada → REFUNDED;
 *  3. estorno em andamento (pedido por nós ou pelo provedor) → REFUND_REQUESTED;
 *  4. alguma paga → PAID (no cartão parcelado, todas as parcelas são aprovadas juntas);
 *  5. todas canceladas → CANCELED;
 *  6. alguma vencida → OVERDUE;
 *  7. senão → PENDING.
 * Só as cobranças decidem: se o provedor NEGAR um estorno, a cobrança volta a "paga" e o pedido
 * também (o aluno recupera o acesso sozinho).
 */
export function deriveOrderStatus(payments: Array<{ status: PaymentStatus }>): OrderStatus {
  const statuses = payments.map((payment) => payment.status);
  if (statuses.includes("CHARGEBACK")) return "CHARGEBACK";
  if (statuses.includes("REFUNDED")) return "REFUNDED";
  if (statuses.includes("REFUND_REQUESTED")) return "REFUND_REQUESTED";
  if (statuses.some(isPaidStatus)) return "PAID";
  if (statuses.length > 0 && statuses.every((status) => status === "CANCELED")) return "CANCELED";
  if (statuses.includes("OVERDUE")) return "OVERDUE";
  return "PENDING";
}

export type RefundCheck = { ok: true } | { ok: false; reason: string };

/**
 * Pode pedir reembolso?
 *  - Só de pedido PAGO.
 *  - O ALUNO pode pedir pelo site até 7 dias depois do pagamento (direito de arrependimento).
 *  - O ADMIN pode reembolsar a qualquer momento (ex.: atendimento ao cliente).
 */
export function checkRefundEligibility(input: {
  status: OrderStatus;
  paidAt: Date | null;
  now: Date;
  requestedBy: "STUDENT" | "ADMIN";
}): RefundCheck {
  if (input.status === "REFUND_REQUESTED" || input.status === "REFUNDED") {
    return { ok: false, reason: "O reembolso deste pedido já foi pedido." };
  }
  if (input.status !== "PAID") {
    return { ok: false, reason: "Só pedidos pagos podem ser reembolsados." };
  }
  if (input.requestedBy === "STUDENT" && !isWithinRefundWindow(input.paidAt, input.now)) {
    return {
      ok: false,
      reason: `O prazo de ${REFUND_WINDOW_DAYS} dias para pedir reembolso pelo site terminou. Fale com o suporte.`,
    };
  }
  return { ok: true };
}

/** Ainda está dentro dos 7 dias depois do pagamento? */
export function isWithinRefundWindow(paidAt: Date | null, now: Date): boolean {
  if (!paidAt) return false;
  return now.getTime() - paidAt.getTime() <= REFUND_WINDOW_DAYS * DAY_IN_MS;
}

/** Quantos meses um ciclo do plano cobre. */
export function cycleMonths(cycle: PlanCycle): number {
  return cycle === "MONTHLY" ? 1 : 12;
}

/** Vencimento do ciclo seguinte ("próxima cobrança em ..."). */
export function nextCycleDueDate(dueDate: DateOnly, cycle: PlanCycle): DateOnly {
  return addMonths(dueDate, cycleMonths(cycle));
}

/**
 * Até quando um ciclo pago da assinatura libera o acesso (sempre até o FIM de um dia de Brasília,
 * para "acesso até 06/11" na tela valer o dia 06/11 inteiro):
 *  - assinatura valendo: até o 5º dia depois do vencimento do ciclo seguinte — a tolerância para o
 *    próximo pagamento ser confirmado. Ex.: ciclo de 01/10, mensal → até 06/11 (fim do dia).
 *  - assinatura CANCELADA: não há próximo pagamento para esperar, então sem tolerância — até a
 *    véspera do vencimento seguinte. Ex.: ciclo de 01/10, mensal → até 31/10 (fim do dia).
 * O período conta a partir do VENCIMENTO (não do dia em que pagou): pagar atrasado não "empurra"
 * o calendário da assinatura.
 */
export function subscriptionPeriodEnd(dueDate: DateOnly, cycle: PlanCycle, options: { canceled: boolean }): Date {
  const nextDueDate = nextCycleDueDate(dueDate, cycle);
  const lastDay = options.canceled ? addDays(nextDueDate, -1) : addDays(nextDueDate, SUBSCRIPTION_GRACE_DAYS);
  return endOfDayInSaoPaulo(lastDay);
}

// Ordem "natural" da vida de uma cobrança. Serve só para DESEMPATAR dois avisos com o mesmo
// horário (o Asaas manda o horário com precisão de segundos, e dois avisos podem cair no mesmo).
const STATUS_PROGRESS: Record<PaymentStatus, number> = {
  PENDING: 0,
  OVERDUE: 1,
  CONFIRMED: 2,
  RECEIVED: 3,
  REFUND_REQUESTED: 4,
  CHARGEBACK: 5,
  REFUNDED: 6,
  CANCELED: 6,
};

/**
 * Este aviso está ATRASADO (é mais antigo que o último já aplicado)? Se sim, é ignorado — avisos
 * podem chegar fora de ordem, e um antigo não pode desfazer um novo (ex.: "vencida" chegando
 * depois de "paga").
 *
 * Os horários vêm como texto "AAAA-MM-DD HH:mm:ss", que se compara em ordem alfabética igual à
 * ordem do tempo. No EMPATE (mesmo segundo), vale o status mais "adiantado" na vida da cobrança:
 * "estornada" e "estorno em andamento" no mesmo segundo → fica "estornada", em qualquer ordem
 * de chegada. Sem horário (ex.: conferência pelo painel), nunca é considerado atrasado.
 */
export function isOutdatedChargeUpdate(input: {
  incomingAt: string | null;
  incomingStatus: PaymentStatus;
  lastAppliedAt: string | null;
  currentStatus: PaymentStatus;
}): boolean {
  if (!input.incomingAt || !input.lastAppliedAt) return false;
  if (input.incomingAt !== input.lastAppliedAt) return input.incomingAt < input.lastAppliedAt;
  return STATUS_PROGRESS[input.incomingStatus] < STATUS_PROGRESS[input.currentStatus];
}
