/**
 * rules.ts — Regras dos afiliados: código do link, quem ganha a venda e a comissão de cada pagamento.
 *
 * Quem chama: o link de divulgação (`/r/<codigo>`), o checkout (quem fica com a venda), a área do
 * afiliado e o painel (situação e soma das comissões). Arquivo "puro", testado em `rules.test.ts`.
 *
 * Como funciona:
 *  1. O afiliado divulga `/r/<codigo>`: guardamos o código num cookie por 30 dias (vale o ÚLTIMO
 *     link clicado) e levamos a pessoa para a página escolhida.
 *  2. Na compra, a venda vai para o afiliado do CUPOM (se o cupom for de um afiliado) ou do cookie.
 *     Ninguém ganha comissão comprando pelo próprio link/cupom.
 *  3. O pedido/assinatura guarda o afiliado e a comissão combinada ("foto" do momento da venda).
 *  4. Cada cobrança PAGA gera comissão (na assinatura, cada ciclo pago). A comissão fica "em
 *     carência" durante o prazo de arrependimento (7 dias) e depois fica "liberada" para pagar.
 *     Estorno ou contestação cancelam a comissão.
 *  5. O admin paga FORA do site (ex.: Pix) e registra o pagamento no painel.
 */
import type { PaymentStatus } from "@/generated/prisma/enums";

import { REFUND_WINDOW_DAYS, isPaidStatus, isReversedStatus } from "@/modules/payments/rules";

export const AFFILIATE_COOKIE = "ct_afiliado";
export const AFFILIATE_COOKIE_DAYS = 30;
export const AFFILIATE_CODE_PATTERN = /^[a-z0-9-]{3,30}$/;
// Nome do parâmetro do destino no link: /r/<codigo>?para=/cursos/...
export const AFFILIATE_TARGET_PARAM = "para";
// A comissão só fica liberada depois do prazo de arrependimento (o aluno ainda pode pedir reembolso).
export const COMMISSION_HOLD_DAYS = REFUND_WINDOW_DAYS;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** " Joao-10 " → "joao-10". */
export function normalizeAffiliateCode(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidAffiliateCode(code: string): boolean {
  return AFFILIATE_CODE_PATTERN.test(code);
}

/** 2000 → "20%"; 1250 → "12,5%". (Comissão em pontos-base: 100 = 1%.) */
export function formatCommissionRate(bps: number): string {
  const percent = bps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0+$/, "").replace(".", ",")}%`;
}

/** Comissão de um valor pago, em centavos (arredonda para baixo: nunca paga um centavo a mais). */
export function commissionCents(valueCents: number, bps: number): number {
  return Math.floor((valueCents * bps) / 10000);
}

export type CommissionStatus = "HOLD" | "AVAILABLE" | "PAID_OUT" | "CANCELED";

/**
 * Situação da comissão de UMA cobrança. `null` = não gera comissão (nunca foi paga).
 * Passos:
 *  1. Já entrou num pagamento ao afiliado → PAID_OUT (e avisa se a cobrança foi estornada DEPOIS,
 *     para o admin descontar do próximo pagamento).
 *  2. Estorno (pedido ou feito) ou contestação → CANCELED.
 *  3. Paga: até 7 dias depois do pagamento → HOLD (carência); depois → AVAILABLE (liberada).
 */
export function commissionStatus(input: {
  paymentStatus: PaymentStatus;
  paidAt: Date | null;
  paidOut: boolean;
  now: Date;
}): { status: CommissionStatus; refundedAfterPayout: boolean } | null {
  const reversed = isReversedStatus(input.paymentStatus);
  if (input.paidOut) return { status: "PAID_OUT", refundedAfterPayout: reversed };
  if (reversed) return input.paidAt ? { status: "CANCELED", refundedAfterPayout: false } : null;
  if (!isPaidStatus(input.paymentStatus)) return null;
  const paidAt = input.paidAt ?? input.now;
  const releasedAt = paidAt.getTime() + COMMISSION_HOLD_DAYS * DAY_IN_MS;
  return { status: input.now.getTime() < releasedAt ? "HOLD" : "AVAILABLE", refundedAfterPayout: false };
}

/** Quando a comissão de um pagamento feito em `paidAt` fica liberada. */
export function commissionReleaseDate(paidAt: Date): Date {
  return new Date(paidAt.getTime() + COMMISSION_HOLD_DAYS * DAY_IN_MS);
}

export type AffiliateRef = { id: string; userId: string; commissionBps: number; isActive: boolean };

/**
 * Quem fica com a venda: o afiliado do cupom (se houver e estiver ativo) ou o do link (cookie).
 * Comprar pelo próprio link ou cupom não gera comissão para ninguém.
 */
export function resolveAttribution(input: {
  couponAffiliate: AffiliateRef | null;
  linkAffiliate: AffiliateRef | null;
  buyerId: string;
}): { affiliateId: string; commissionBps: number } | null {
  const chosen = input.couponAffiliate?.isActive
    ? input.couponAffiliate
    : input.linkAffiliate?.isActive
      ? input.linkAffiliate
      : null;
  if (!chosen || chosen.userId === input.buyerId) return null;
  return { affiliateId: chosen.id, commissionBps: chosen.commissionBps };
}

/** Soma das comissões por situação (centavos). */
export function summarizeCommissions(items: Array<{ status: CommissionStatus; amountCents: number }>) {
  const totals: Record<CommissionStatus, number> = { HOLD: 0, AVAILABLE: 0, PAID_OUT: 0, CANCELED: 0 };
  for (const item of items) totals[item.status] += item.amountCents;
  return totals;
}

/** Link de divulgação: "https://site/r/joao" ou "https://site/r/joao?para=%2Fcursos%2Fx". */
export function referralLink(siteUrl: string, code: string, targetPath: string | null): string {
  const url = new URL(`/r/${code}`, siteUrl);
  if (targetPath && targetPath !== "/") url.searchParams.set(AFFILIATE_TARGET_PARAM, targetPath);
  return url.toString();
}

/** Textos da situação da comissão (área do afiliado e painel). */
export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  HOLD: "Em carência",
  AVAILABLE: "Liberada",
  PAID_OUT: "Paga",
  CANCELED: "Cancelada (estorno)",
};
