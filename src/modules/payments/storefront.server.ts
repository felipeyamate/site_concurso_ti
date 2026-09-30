/**
 * storefront.server.ts — Consultas das telas de venda do ALUNO: ofertas, checkout, "Minhas
 * compras" e a página de pagamento.
 *
 * Quem chama: as páginas /cursos/[curso] (ofertas), /planos, /comprar, /assinar,
 * /area-do-aluno/compras e /area-do-aluno/pagamentos/[id].
 *
 * Só LEITURA — com uma exceção: na 1ª visita à página de um Pix, o QR Code é buscado no provedor
 * e guardado (as próximas visitas, e o "atualizar a cada 5 s", não chamam o provedor de novo).
 */
import "server-only";

import { prisma } from "@/lib/db";

import { computeSubscriptionAccess } from "./access-sync";
import { getProviderForRecord } from "./provider/provider.server";
import { isPaidStatus, isWithinRefundWindow } from "./rules";

// ---------------------------------------------------------------------------------------------
// Ofertas e checkout
// ---------------------------------------------------------------------------------------------

const productCardSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  priceCents: true,
  accessDays: true,
  maxInstallments: true,
} as const;

const planCardSelect = { id: true, slug: true, title: true, description: true, priceCents: true, cycle: true } as const;

/** Como comprar um curso: produtos ativos que o incluem e, se ele faz parte da assinatura, os planos. */
export async function getOffersForCourse(courseId: string) {
  const [products, course] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, courses: { some: { courseId } } },
      orderBy: { priceCents: "asc" },
      select: { ...productCardSelect, _count: { select: { courses: true } } },
    }),
    prisma.course.findUnique({ where: { id: courseId }, select: { includedInSubscription: true } }),
  ]);
  const plans = course?.includedInSubscription
    ? await prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: "asc" }, select: planCardSelect })
    : [];
  return { products, plans };
}

/** Produto ativo para a página de compra, com os cursos que ele libera. */
export async function getProductForCheckout(slug: string) {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    select: {
      ...productCardSelect,
      courses: { select: { course: { select: { id: true, slug: true, title: true, isPublished: true } } } },
    },
  });
}

/** Planos ativos (página /planos) e os cursos publicados que a assinatura libera. */
export async function listPlansPage() {
  const [plans, courses] = await Promise.all([
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: "asc" }, select: planCardSelect }),
    prisma.course.findMany({
      where: { includedInSubscription: true, isPublished: true },
      orderBy: [{ position: "asc" }, { title: "asc" }],
      select: { id: true, slug: true, title: true, subtitle: true },
    }),
  ]);
  return { plans, courses };
}

export async function getPlanForCheckout(slug: string) {
  return prisma.plan.findFirst({ where: { slug, isActive: true }, select: planCardSelect });
}

/** Pedidos do aluno para este produto que ainda esperam pagamento (o checkout avisa). */
export async function listPendingOrdersForProduct(userId: string, productId: string) {
  return prisma.order.findMany({
    where: { userId, productId, status: { in: ["PENDING", "OVERDUE"] } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, createdAt: true, method: true, payments: { take: 1, orderBy: { createdAt: "asc" }, select: { id: true } } },
  });
}

// ---------------------------------------------------------------------------------------------
// Minhas compras
// ---------------------------------------------------------------------------------------------

/**
 * Pedidos e assinaturas do aluno, já com o que as telas precisam decidir:
 * se dá para pedir reembolso, qual cobrança pagar, até quando a assinatura vale.
 */
export async function listMyPurchases(userId: string, now: Date = new Date()) {
  const [orders, subscriptions] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        productTitle: true,
        priceCents: true,
        discountCents: true,
        couponCode: true,
        method: true,
        installments: true,
        status: true,
        paidAt: true,
        createdAt: true,
        accessDays: true,
        payments: {
          orderBy: { createdAt: "asc" },
          select: { id: true, status: true, fiscalInvoice: { select: { status: true, pdfUrl: true, number: true } } },
        },
      },
    }),
    prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        planTitle: true,
        priceCents: true,
        discountCents: true,
        couponCode: true,
        cycle: true,
        method: true,
        status: true,
        canceledAt: true,
        createdAt: true,
        payments: {
          orderBy: { dueDate: "asc" },
          select: {
            id: true,
            status: true,
            dueDate: true,
            paidAt: true,
            valueCents: true,
            fiscalInvoice: { select: { status: true, pdfUrl: true, number: true } },
          },
        },
      },
    }),
  ]);

  return {
    orders: orders.map((order) => ({
      ...order,
      // A 1ª cobrança (única, ou a 1ª parcela) é a que o aluno paga.
      payPaymentId: order.payments[0]?.id ?? null,
      canRequestRefund: order.status === "PAID" && isWithinRefundWindow(order.paidAt, now),
      invoices: order.payments.map((payment) => payment.fiscalInvoice).filter((invoice) => invoice !== null),
    })),
    subscriptions: subscriptions.map((subscription) => {
      const paid = subscription.payments.filter((payment) => isPaidStatus(payment.status) && payment.paidAt);
      const period = computeSubscriptionAccess(
        paid.map((payment) => ({
          paidAt: payment.paidAt as Date,
          dueDate: payment.dueDate,
          cycle: subscription.cycle,
          canceled: subscription.status === "CANCELED",
        })),
      );
      const openPayment = subscription.payments.find((payment) => payment.status === "PENDING" || payment.status === "OVERDUE");
      return {
        ...subscription,
        paidUntil: period?.expiresAt ?? null,
        openPaymentId: subscription.status === "CANCELED" ? null : (openPayment?.id ?? null),
        // Arrependimento: só o 1º pagamento, em até 7 dias.
        canRequestRefund: subscription.status !== "CANCELED" && paid.length === 1 && isWithinRefundWindow(paid[0].paidAt, now),
        invoices: subscription.payments.map((payment) => payment.fiscalInvoice).filter((invoice) => invoice !== null),
      };
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// Página de pagamento
// ---------------------------------------------------------------------------------------------

/**
 * Uma cobrança para a página "como pagar". Só o dono (ou um admin) vê; outra pessoa → null.
 * Pix pendente: busca o QR Code no provedor na 1ª vez e guarda.
 */
export async function getPaymentForViewer(params: { paymentId: string; userId: string; isAdmin: boolean }) {
  const payment = await prisma.payment.findUnique({
    where: { id: params.paymentId },
    select: {
      id: true,
      provider: true,
      providerPaymentId: true,
      method: true,
      status: true,
      valueCents: true,
      dueDate: true,
      paidAt: true,
      invoiceUrl: true,
      bankSlipUrl: true,
      pixPayload: true,
      pixImage: true,
      installmentNumber: true,
      order: { select: { id: true, userId: true, productTitle: true, installments: true, priceCents: true, status: true } },
      subscription: { select: { id: true, userId: true, planTitle: true, cycle: true, status: true } },
    },
  });
  const ownerId = payment?.order?.userId ?? payment?.subscription?.userId;
  if (!payment || (ownerId !== params.userId && !params.isAdmin)) return null;

  const waiting = payment.status === "PENDING" || payment.status === "OVERDUE";
  if (payment.method === "PIX" && waiting && !payment.pixPayload) {
    const provider = getProviderForRecord(payment.provider);
    try {
      const qr = provider ? await provider.getPixQrCode(payment.providerPaymentId) : null;
      if (qr) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { pixPayload: qr.payload, pixImage: qr.imageDataUrl },
        });
        return { ...payment, pixPayload: qr.payload, pixImage: qr.imageDataUrl };
      }
    } catch (error) {
      // Sem o QR Code, a página mostra o link da fatura (onde também dá para pagar com Pix).
      console.error(`[pagamento] Falha ao buscar o QR Code do Pix da cobrança ${payment.id}:`, error);
    }
  }
  return payment;
}
