/**
 * sales-admin.server.ts — O painel de vendas (só ADMIN): produtos, planos, cursos da assinatura,
 * pedidos, assinaturas e avisos do provedor.
 *
 * Quem chama: as páginas /admin/vendas/... e as Server Actions de `actions.ts` (que já conferiram
 * o perfil ADMIN). Os testes de integração chamam direto.
 * O que devolve: os dados pedidos; problemas ESPERADOS viram `UserFacingError` (mensagem na tela).
 *
 * Regras:
 *  - Produtos e planos nascem INATIVOS (ninguém compra até você revisar e ativar).
 *  - Produto só ativa com pelo menos um curso.
 *  - Não se apaga produto/plano que já vendeu (histórico financeiro): desative.
 *  - Mudar preço/cursos/dias de um produto NÃO muda compras já feitas (cada pedido tem a sua "foto").
 */
import "server-only";

import type { OrderStatus, PlanCycle, SubscriptionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { isRecordNotFound, isUniqueViolation } from "@/lib/db-errors";
import { UserFacingError } from "@/lib/form-state";
import { findAvailableSlug } from "@/modules/catalog/admin/slug";

import { syncAllSubscribers } from "../access-sync.server";
import { applyChargeUpdate } from "../charges.server";
import { runEffects } from "../effects.server";
import { scheduleFiscalInvoice } from "../fiscal.server";
import { dateToEventTime } from "../provider/asaas/mapping";
import { getProviderForRecord } from "../provider/provider.server";
import { PaymentProviderError } from "../provider/types";
import { processWebhookEvent, type WebhookOutcome } from "../webhook.server";

export const ADMIN_PAGE_SIZE = 30;

// =============================================================================================
// Produtos
// =============================================================================================

export async function listProductsForAdmin() {
  return prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      priceCents: true,
      accessDays: true,
      maxInstallments: true,
      isActive: true,
      courses: { select: { course: { select: { title: true } } } },
      _count: { select: { orders: true } },
    },
  });
}

export async function getProductForAdmin(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: { courses: { select: { courseId: true } }, _count: { select: { orders: true } } },
  });
}

/** Todos os cursos (para as listas de marcar), com o que o painel precisa mostrar. */
export async function listCoursesForSales() {
  return prisma.course.findMany({
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: { id: true, title: true, isPublished: true, includedInSubscription: true },
  });
}

/** Cria um produto (inativo, sem cursos) com endereço gerado a partir do nome. */
export async function createProduct(input: { title: string; priceCents: number; accessDays: number | null; maxInstallments: number }) {
  const slug = await findAvailableSlug(input.title, async (candidate) =>
    Boolean(await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );
  try {
    return await prisma.product.create({
      data: { ...input, slug, isActive: false },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Outro produto foi criado com este nome agora. Tente de novo.");
    throw error;
  }
}

export async function updateProduct(input: {
  productId: string;
  title: string;
  slug: string;
  description: string;
  priceCents: number;
  accessDays: number | null;
  maxInstallments: number;
  isActive: boolean;
  courseIds: string[];
}) {
  const courseIds = [...new Set(input.courseIds)];
  if (input.isActive && courseIds.length === 0) {
    throw new UserFacingError("Marque pelo menos um curso antes de ativar o produto.", { field: "courseIds" });
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const existingCourses = await tx.course.count({ where: { id: { in: courseIds } } });
      if (existingCourses !== courseIds.length) throw new UserFacingError("Um dos cursos marcados não existe mais.");
      const product = await tx.product.update({
        where: { id: input.productId },
        data: {
          title: input.title,
          slug: input.slug,
          description: input.description,
          priceCents: input.priceCents,
          accessDays: input.accessDays,
          maxInstallments: input.maxInstallments,
          isActive: input.isActive,
        },
      });
      // Troca a lista de cursos inteira (é pequena): apaga e recria.
      await tx.productCourse.deleteMany({ where: { productId: input.productId } });
      await tx.productCourse.createMany({ data: courseIds.map((courseId) => ({ productId: input.productId, courseId })) });
      return product;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Já existe outro produto com este endereço.", { field: "slug" });
    if (isRecordNotFound(error)) throw new UserFacingError("Produto não encontrado.");
    throw error;
  }
}

/** Apaga um produto que NUNCA vendeu (senão: desative). */
export async function deleteProduct(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { _count: { select: { orders: true } } } });
  if (!product) throw new UserFacingError("Produto não encontrado.");
  if (product._count.orders > 0) {
    throw new UserFacingError("Este produto já tem pedidos (histórico financeiro). Desative em vez de apagar.");
  }
  await prisma.product.delete({ where: { id: productId } });
}

// =============================================================================================
// Planos e cursos da assinatura
// =============================================================================================

export async function listPlansForAdmin() {
  return prisma.plan.findMany({
    orderBy: [{ isActive: "desc" }, { priceCents: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      priceCents: true,
      cycle: true,
      isActive: true,
      _count: { select: { subscriptions: true } },
    },
  });
}

export async function getPlanForAdmin(planId: string) {
  return prisma.plan.findUnique({ where: { id: planId }, include: { _count: { select: { subscriptions: true } } } });
}

export async function createPlan(input: { title: string; priceCents: number; cycle: PlanCycle }) {
  const slug = await findAvailableSlug(input.title, async (candidate) =>
    Boolean(await prisma.plan.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );
  try {
    return await prisma.plan.create({ data: { ...input, slug, isActive: false } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Outro plano foi criado com este nome agora. Tente de novo.");
    throw error;
  }
}

export async function updatePlan(input: {
  planId: string;
  title: string;
  slug: string;
  description: string;
  priceCents: number;
  cycle: PlanCycle;
  isActive: boolean;
}) {
  try {
    const { planId, ...data } = input;
    return await prisma.plan.update({ where: { id: planId }, data });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Já existe outro plano com este endereço.", { field: "slug" });
    if (isRecordNotFound(error)) throw new UserFacingError("Plano não encontrado.");
    throw error;
  }
}

export async function deletePlan(planId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { _count: { select: { subscriptions: true } } } });
  if (!plan) throw new UserFacingError("Plano não encontrado.");
  if (plan._count.subscriptions > 0) {
    throw new UserFacingError("Este plano já tem assinaturas (histórico financeiro). Desative em vez de apagar.");
  }
  await prisma.plan.delete({ where: { id: planId } });
}

/**
 * Define quais cursos a assinatura libera e recalcula os assinantes: quem está em dia ganha o
 * curso novo na hora. Devolve quantos assinantes foram recalculados.
 */
export async function setSubscriptionCourses(courseIds: string[]): Promise<number> {
  const unique = [...new Set(courseIds)];
  await prisma.$transaction([
    prisma.course.updateMany({ where: { id: { in: unique } }, data: { includedInSubscription: true } }),
    prisma.course.updateMany({ where: { id: { notIn: unique } }, data: { includedInSubscription: false } }),
  ]);
  return syncAllSubscribers();
}

// =============================================================================================
// Pedidos, assinaturas e avisos
// =============================================================================================

function userSearch(search: string) {
  const text = search.trim();
  return text
    ? {
        user: {
          OR: [
            { email: { contains: text, mode: "insensitive" as const } },
            { name: { contains: text, mode: "insensitive" as const } },
          ],
        },
      }
    : {};
}

export async function listOrdersForAdmin(params: { status: OrderStatus | null; search: string; page: number }) {
  const where = { ...(params.status ? { status: params.status } : {}), ...userSearch(params.search) };
  const page = Math.max(1, params.page);
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        productTitle: true,
        priceCents: true,
        method: true,
        installments: true,
        status: true,
        provider: true,
        createdAt: true,
        paidAt: true,
        refundRequestedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return { orders, total, page, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

export async function getOrderForAdmin(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      courses: { select: { course: { select: { id: true, title: true } } } },
      payments: { orderBy: { createdAt: "asc" }, include: { fiscalInvoice: true } },
      // Fase 6: afiliado da venda (o cupom já vem no próprio pedido: couponCode/discountCents).
      affiliate: { select: { id: true, code: true, user: { select: { name: true } } } },
    },
  });
}

export async function listSubscriptionsForAdmin(params: {
  status: SubscriptionStatus | null;
  search: string;
  page: number;
  // Só as que têm estorno de boleto pendente (a fazer à mão no painel do Asaas).
  manualRefundPending?: boolean;
}) {
  const where = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.manualRefundPending ? { payments: { some: { manualRefundRequestedAt: { not: null } } } } : {}),
    ...userSearch(params.search),
  };
  const page = Math.max(1, params.page);
  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        planTitle: true,
        priceCents: true,
        cycle: true,
        method: true,
        status: true,
        provider: true,
        createdAt: true,
        canceledAt: true,
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { payments: true } },
      },
    }),
    prisma.subscription.count({ where }),
  ]);
  return { subscriptions, total, page, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

export async function getSubscriptionForAdmin(subscriptionId: string) {
  return prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      payments: { orderBy: { dueDate: "asc" }, include: { fiscalInvoice: true } },
      affiliate: { select: { id: true, code: true, user: { select: { name: true } } } },
    },
  });
}

export async function listWebhookEvents(params: { onlyErrors: boolean; page: number }) {
  const where = params.onlyErrors ? { error: { not: null } } : {};
  const page = Math.max(1, params.page);
  const [events, total] = await Promise.all([
    prisma.webhookEvent.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        provider: true,
        eventId: true,
        type: true,
        receivedAt: true,
        processedAt: true,
        note: true,
        error: true,
        attempts: true,
      },
    }),
    prisma.webhookEvent.count({ where }),
  ]);
  return { events, total, page, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

/** Números da visão geral de vendas (últimos 30 dias) e o que precisa de atenção. */
export async function getSalesOverview(now: Date = new Date()) {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [paidOrders, revenue, activeSubscriptions, webhookErrors, manualRefunds, manualSubscriptionRefunds, invoiceProblems] = await Promise.all([
    prisma.order.count({ where: { status: "PAID", paidAt: { gte: since } } }),
    prisma.payment.aggregate({
      where: { status: { in: ["CONFIRMED", "RECEIVED"] }, paidAt: { gte: since } },
      _sum: { valueCents: true },
    }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.webhookEvent.count({ where: { error: { not: null } } }),
    // Boletos com reembolso pedido e ainda não estornados: o estorno é manual no painel do Asaas.
    // (A marca some sozinha quando o Asaas mostra o estorno.) Pedidos e assinaturas, separados.
    prisma.order.count({ where: { payments: { some: { manualRefundRequestedAt: { not: null } } } } }),
    prisma.subscription.count({ where: { payments: { some: { manualRefundRequestedAt: { not: null } } } } }),
    prisma.fiscalInvoice.count({ where: { OR: [{ status: "ERROR" }, { status: "PENDING", error: { not: null } }] } }),
  ]);
  return {
    paidOrders,
    revenueCents: revenue._sum.valueCents ?? 0,
    activeSubscriptions,
    webhookErrors,
    manualRefunds,
    manualSubscriptionRefunds,
    invoiceProblems,
  };
}

// =============================================================================================
// Ações de suporte
// =============================================================================================

/**
 * "Conferir no provedor": busca a situação ATUAL da cobrança no provedor e aplica (útil quando um
 * aviso se perdeu). A situação atual vale mais que qualquer aviso antigo.
 */
export async function syncPaymentWithProvider(paymentId: string, now: Date = new Date()): Promise<string> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { provider: true, providerPaymentId: true },
  });
  if (!payment) throw new UserFacingError("Cobrança não encontrada.");
  const provider = getProviderForRecord(payment.provider);
  if (!provider) throw new UserFacingError("O provedor desta cobrança não está disponível.");
  let charge;
  try {
    charge = await provider.getCharge(payment.providerPaymentId);
  } catch (error) {
    throw new UserFacingError(error instanceof PaymentProviderError ? error.message : "O provedor não respondeu.");
  }
  const result = await applyChargeUpdate({
    provider: payment.provider,
    charge,
    occurredAt: dateToEventTime(now),
    mode: "sync",
    now,
  });
  await runEffects(result.effects);
  return result.note;
}

/** Reprocessa um aviso gravado (ex.: depois de corrigir um problema). */
export async function reprocessWebhookEvent(eventRowId: string): Promise<WebhookOutcome> {
  const exists = await prisma.webhookEvent.findUnique({ where: { id: eventRowId }, select: { id: true } });
  if (!exists) throw new UserFacingError("Aviso não encontrado.");
  return processWebhookEvent(eventRowId);
}

/** "Tentar emitir de novo" a nota fiscal de uma cobrança paga. */
export async function retryFiscalInvoice(paymentId: string): Promise<void> {
  await scheduleFiscalInvoice(paymentId);
}
