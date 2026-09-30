/**
 * checkout.server.ts — Criar uma compra (pedido + cobrança) ou uma assinatura no provedor.
 *
 * Quem chama: as Server Actions de compra (`actions.ts`), depois de conferir o login e validar
 * o formulário. Os testes de integração chamam direto.
 *
 * O que NÃO acontece aqui: liberar acesso. Criar a cobrança só gera o "boleto/Pix/link do
 * cartão"; o acesso vem quando o provedor AVISA que foi pago (webhook).
 *
 * Passos de uma compra:
 *  1. Confere o produto (ativo, com cursos), o cupom (prévia), as parcelas e o limite de pedidos
 *     por dia.
 *  2. Garante o cliente no provedor (CPF fica guardado depois da 1ª compra).
 *  3. Com a trava do aluno: confere o limite e o CUPOM de novo (com a trava do cupom — Fase 6),
 *     decide o AFILIADO da venda e cria o PEDIDO no nosso banco (com a "foto" do produto, o
 *     desconto e o afiliado) — o ID dele vai na cobrança.
 *  4. Cria a COBRANÇA no provedor. Se falhar, o pedido fica "cancelado" com o motivo.
 *  5. Registra a cobrança no nosso banco (modo "initial" — se um aviso chegou antes, ele vale).
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { withAdvisoryLock } from "@/lib/db-locks";
import { UserFacingError } from "@/lib/form-state";

import { resolveSaleAttribution } from "@/modules/affiliates/affiliates.server";
import { previewCoupon, reserveCoupon } from "@/modules/coupons/coupons.server";
import type { CouponTarget } from "@/modules/coupons/rules";

import { applyChargeUpdate } from "./charges.server";
import { formatCpf, isValidCpf, maskCpf, normalizeCpf } from "./cpf";
import { runEffects } from "./effects.server";
import { installmentOptions } from "./money";
import { getPaymentProvider } from "./provider/provider.server";
import { providerErrorMessage, type PaymentProvider } from "./provider/types";
import { MAX_NEW_ORDERS_PER_DAY, computeDueDate } from "./rules";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type Buyer = { id: string; name: string; email: string };
export type BillingInput = { cpf: string; phone: string | null };

const SALES_OFF_MESSAGE = "As vendas estão temporariamente desligadas. Tente de novo mais tarde.";

/**
 * Endereço para onde o provedor manda o aluno depois de pagar com cartão. O Asaas só aceita o
 * domínio cadastrado na conta, então em desenvolvimento (localhost) não mandamos nenhum.
 */
function successUrlFor(path: string): string | null {
  const url = new URL(path, env.BETTER_AUTH_URL);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  return url.protocol === "https:" && !isLocal ? url.toString() : null;
}

type Tx = Prisma.TransactionClient;

/**
 * Roda `work` numa transação com a trava de checkout do aluno (`checkout:<id>`). Tudo que é
 * "confere e cria" no checkout passa por aqui (regra do CLAUDE.md sobre travas).
 */
async function withCheckoutLock<T>(userId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  // Pode incluir uma chamada ao provedor (até 15 s) e esperar a trava de outro clique.
  return withAdvisoryLock(prisma, `checkout:${userId}`, work, { maxWait: 10_000, timeout: 40_000 });
}

/** As parcelas escolhidas existem para este preço? (O preço com cupom pode ter menos opções.) */
function checkInstallments(priceCents: number, maxInstallments: number, installments: number): void {
  const allowed = installmentOptions(priceCents, maxInstallments).map((option) => option.count);
  if (!allowed.includes(installments)) {
    throw new UserFacingError("Número de parcelas indisponível para este produto.", { field: "installments" });
  }
}

/** Limite de pedidos/assinaturas novos por aluno em 24 h. */
async function checkDailyLimit(tx: Tx, userId: string, now: Date): Promise<void> {
  const since = new Date(now.getTime() - DAY_IN_MS);
  const orders = await tx.order.count({ where: { userId, createdAt: { gte: since } } });
  const subscriptions = await tx.subscription.count({ where: { userId, createdAt: { gte: since } } });
  if (orders + subscriptions >= MAX_NEW_ORDERS_PER_DAY) {
    throw new UserFacingError("Você já iniciou muitas compras hoje. Pague uma das pendentes ou tente amanhã.");
  }
}

/**
 * Uma assinatura por vez: a que está valendo (ou esperando o 1º pagamento) precisa ser usada ou
 * cancelada antes (em "Minhas compras").
 */
async function checkNoOpenSubscription(tx: Tx, userId: string): Promise<void> {
  const current = await tx.subscription.findFirst({
    where: { userId, status: { in: ["PENDING", "ACTIVE"] } },
    select: { status: true },
  });
  if (current) {
    throw new UserFacingError(
      current.status === "ACTIVE"
        ? "Você já tem uma assinatura ativa. Veja em \"Minhas compras\"."
        : "Você já tem uma assinatura esperando o 1º pagamento. Pague ou cancele em \"Minhas compras\".",
    );
  }
}

/**
 * Garante que o aluno existe como cliente no provedor e devolve o ID dele.
 * O CPF fica gravado depois da 1ª compra: um CPF diferente é recusado (trocar = suporte), para
 * nenhuma conta "emprestar" compras para outro documento.
 *
 * Roda com a trava de checkout do aluno (a chamada ao provedor fica dentro dela): na 1ª compra,
 * dois cliques ao mesmo tempo não cadastram o aluno duas vezes no provedor — o segundo espera e
 * reaproveita o cadastro do primeiro.
 */
async function ensureCustomer(provider: PaymentProvider, buyer: Buyer, billing: BillingInput): Promise<string> {
  const cpf = normalizeCpf(billing.cpf);
  if (!isValidCpf(cpf)) throw new UserFacingError("CPF inválido. Confira os números.", { field: "cpf" });

  return withCheckoutLock(buyer.id, async (tx) => {
    const profile = await tx.billingProfile.findUnique({ where: { userId: buyer.id } });
    if (profile && profile.cpf !== cpf) {
      throw new UserFacingError(
        `Este CPF é diferente do usado nas suas compras (${maskCpf(profile.cpf)}). Para trocar, fale com o suporte.`,
        { field: "cpf" },
      );
    }
    if (profile?.providerKind === provider.kind && profile.providerCustomerId) {
      return profile.providerCustomerId;
    }

    let customerId: string;
    try {
      ({ customerId } = await provider.createCustomer({
        userId: buyer.id,
        name: buyer.name,
        email: buyer.email,
        cpf,
        phone: billing.phone,
      }));
    } catch (error) {
      throw new UserFacingError(`Não foi possível cadastrar seus dados de pagamento: ${providerErrorMessage(error)}`);
    }
    await tx.billingProfile.upsert({
      where: { userId: buyer.id },
      create: { userId: buyer.id, cpf, phone: billing.phone, providerKind: provider.kind, providerCustomerId: customerId },
      update: { phone: billing.phone, providerKind: provider.kind, providerCustomerId: customerId },
    });
    return customerId;
  });
}

/**
 * Prévia do cupom ANTES de cadastrar o aluno no provedor (um cupom inválido não deve cadastrar nem
 * travar o CPF). Devolve o preço que será cobrado. A conferência que vale é a de `reserveCoupon`.
 */
async function expectedPrice(target: CouponTarget, couponCode: string | null | undefined, buyerId: string, now: Date): Promise<number> {
  if (!couponCode) return target.priceCents;
  const preview = await previewCoupon({ code: couponCode, target, userId: buyerId, now });
  if (!preview.ok) throw new UserFacingError(preview.message, { field: "couponCode" });
  return preview.finalPriceCents;
}

/** Os dados de cobrança já guardados (para preencher o formulário): CPF formatado e celular. */
export async function getBillingDefaults(userId: string): Promise<{ cpf: string; phone: string; cpfLocked: boolean }> {
  const profile = await prisma.billingProfile.findUnique({ where: { userId }, select: { cpf: true, phone: true } });
  return { cpf: profile ? formatCpf(profile.cpf) : "", phone: profile?.phone ?? "", cpfLocked: Boolean(profile) };
}

export async function createOrder(params: {
  buyer: Buyer;
  productSlug: string;
  method: PaymentMethod;
  installments: number;
  billing: BillingInput;
  // Fase 6: cupom digitado e código do afiliado (do cookie do link de divulgação).
  couponCode?: string | null;
  affiliateCode?: string | null;
  now?: Date;
}): Promise<{ orderId: string; paymentId: string | null }> {
  const now = params.now ?? new Date();
  const provider = getPaymentProvider();
  if (!provider) throw new UserFacingError(SALES_OFF_MESSAGE);

  // 1. Produto, cupom (prévia), parcelas e limite diário.
  const product = await prisma.product.findUnique({
    where: { slug: params.productSlug },
    include: { courses: { select: { courseId: true } } },
  });
  if (!product || !product.isActive || product.courses.length === 0) {
    throw new UserFacingError("Este produto não está à venda.");
  }
  const target: CouponTarget = { kind: "PRODUCT", id: product.id, priceCents: product.priceCents };
  const installments = params.method === "CREDIT_CARD" ? params.installments : 1;
  checkInstallments(await expectedPrice(target, params.couponCode, params.buyer.id, now), product.maxInstallments, installments);
  // Confere o limite diário ANTES de cadastrar o aluno no provedor (uma compra recusada não deve
  // cadastrar nem travar o CPF). É conferido de novo, com a trava, na hora de criar o pedido.
  await withCheckoutLock(params.buyer.id, (tx) => checkDailyLimit(tx, params.buyer.id, now));

  // 2. Cliente no provedor.
  const customerId = await ensureCustomer(provider, params.buyer, params.billing);

  // 3. Pedido com a "foto" do produto — o limite diário e o cupom são conferidos e o pedido criado
  //    com a trava do aluno (dois cliques ao mesmo tempo não passam os dois pelo limite) e a do
  //    cupom (dois alunos não levam juntos o último uso).
  const order = await withCheckoutLock(params.buyer.id, async (tx) => {
    await checkDailyLimit(tx, params.buyer.id, now);
    const pricing = params.couponCode ? await reserveCoupon(tx, { code: params.couponCode, target, userId: params.buyer.id, now }) : null;
    const priceCents = pricing?.finalPriceCents ?? product.priceCents;
    checkInstallments(priceCents, product.maxInstallments, installments);
    const attribution = await resolveSaleAttribution(tx, {
      couponAffiliate: pricing?.coupon.affiliate ?? null,
      affiliateCode: params.affiliateCode,
      buyerId: params.buyer.id,
    });
    return tx.order.create({
      data: {
        userId: params.buyer.id,
        productId: product.id,
        productTitle: product.title,
        priceCents,
        discountCents: pricing?.discountCents ?? 0,
        couponId: pricing?.coupon.id ?? null,
        couponCode: pricing?.coupon.code ?? null,
        affiliateId: attribution?.affiliateId ?? null,
        affiliateCommissionBps: attribution?.commissionBps ?? null,
        accessDays: product.accessDays,
        method: params.method,
        installments,
        provider: provider.kind,
        courses: { create: product.courses.map(({ courseId }) => ({ courseId })) },
      },
      select: { id: true, priceCents: true },
    });
  });

  // 4. Cobrança no provedor.
  let charge;
  try {
    charge = await provider.createCharge({
      customerId,
      method: params.method,
      // O valor do PEDIDO (já com o desconto do cupom), nunca o do formulário.
      valueCents: order.priceCents,
      installments,
      dueDate: computeDueDate(params.method, now),
      description: `${product.title} — Concurso TI`,
      externalReference: order.id,
      successUrl: successUrlFor("/area-do-aluno/compras"),
    });
  } catch (error) {
    console.error(`[checkout] Falha ao criar a cobrança do pedido ${order.id}:`, error);
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELED", failureReason: providerErrorMessage(error).slice(0, 500) },
    });
    throw new UserFacingError(`Não foi possível gerar a cobrança: ${providerErrorMessage(error)}`);
  }

  // 5. Registra a cobrança (e liga ao pedido).
  const result = await applyChargeUpdate({ provider: provider.kind, charge, occurredAt: null, mode: "initial", now });
  await runEffects(result.effects);
  return { orderId: order.id, paymentId: result.paymentId };
}

export async function startSubscription(params: {
  buyer: Buyer;
  planSlug: string;
  method: PaymentMethod;
  billing: BillingInput;
  // Fase 6: cupom (o desconto vale em TODAS as renovações) e código do afiliado (cookie).
  couponCode?: string | null;
  affiliateCode?: string | null;
  now?: Date;
}): Promise<{ subscriptionId: string; paymentId: string | null }> {
  const now = params.now ?? new Date();
  const provider = getPaymentProvider();
  if (!provider) throw new UserFacingError(SALES_OFF_MESSAGE);

  const plan = await prisma.plan.findUnique({ where: { slug: params.planSlug } });
  if (!plan || !plan.isActive) throw new UserFacingError("Este plano não está disponível.");
  const target: CouponTarget = { kind: "PLAN", id: plan.id, priceCents: plan.priceCents };
  await expectedPrice(target, params.couponCode, params.buyer.id, now);

  // Confere ANTES de cadastrar o aluno no provedor (um pedido recusado não deve cadastrar nem
  // travar o CPF) e de novo, com a trava, na hora de criar.
  await withCheckoutLock(params.buyer.id, async (tx) => {
    await checkNoOpenSubscription(tx, params.buyer.id);
    await checkDailyLimit(tx, params.buyer.id, now);
  });

  const customerId = await ensureCustomer(provider, params.buyer, params.billing);

  // Confere e cria com a trava do aluno: dois cliques ao mesmo tempo não criam duas assinaturas
  // (seriam duas cobranças recorrentes no cartão/boleto do aluno). O cupom é conferido com a trava
  // dele, como na compra avulsa.
  const subscription = await withCheckoutLock(params.buyer.id, async (tx) => {
    await checkNoOpenSubscription(tx, params.buyer.id);
    await checkDailyLimit(tx, params.buyer.id, now);
    const pricing = params.couponCode ? await reserveCoupon(tx, { code: params.couponCode, target, userId: params.buyer.id, now }) : null;
    const attribution = await resolveSaleAttribution(tx, {
      couponAffiliate: pricing?.coupon.affiliate ?? null,
      affiliateCode: params.affiliateCode,
      buyerId: params.buyer.id,
    });
    return tx.subscription.create({
      data: {
        userId: params.buyer.id,
        planId: plan.id,
        planTitle: plan.title,
        priceCents: pricing?.finalPriceCents ?? plan.priceCents,
        discountCents: pricing?.discountCents ?? 0,
        couponId: pricing?.coupon.id ?? null,
        couponCode: pricing?.coupon.code ?? null,
        affiliateId: attribution?.affiliateId ?? null,
        affiliateCommissionBps: attribution?.commissionBps ?? null,
        cycle: plan.cycle,
        method: params.method,
        provider: provider.kind,
      },
      select: { id: true, priceCents: true },
    });
  });

  let created;
  try {
    created = await provider.createSubscription({
      customerId,
      method: params.method,
      // O valor da ASSINATURA (já com o desconto do cupom, que vale em todas as renovações).
      valueCents: subscription.priceCents,
      cycle: plan.cycle,
      // A 1ª cobrança vence no mesmo prazo de uma compra avulsa (boleto: 3 dias).
      nextDueDate: computeDueDate(params.method, now),
      description: `${plan.title} — Concurso TI`,
      externalReference: subscription.id,
      successUrl: successUrlFor("/area-do-aluno/compras"),
    });
  } catch (error) {
    console.error(`[checkout] Falha ao criar a assinatura ${subscription.id}:`, error);
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELED", canceledAt: now, failureReason: providerErrorMessage(error).slice(0, 500) },
    });
    throw new UserFacingError(`Não foi possível criar a assinatura: ${providerErrorMessage(error)}`);
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { providerSubscriptionId: created.subscriptionId },
  });
  let paymentId: string | null = null;
  if (created.firstCharge) {
    const result = await applyChargeUpdate({
      provider: provider.kind,
      charge: created.firstCharge,
      occurredAt: null,
      mode: "initial",
      now,
    });
    await runEffects(result.effects);
    paymentId = result.paymentId;
  }
  return { subscriptionId: subscription.id, paymentId };
}
