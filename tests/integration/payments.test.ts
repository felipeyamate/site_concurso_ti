/**
 * payments.test.ts — Testes de integração da Fase 4 (vendas), com PostgreSQL de verdade e o
 * provedor de pagamento SIMULADO (nenhuma cobrança real).
 *
 * Rodar: npm run test:integration   (exige TEST_DATABASE_URL — ver README)
 *
 * O que está coberto: compra (Pix, boleto, cartão parcelado), avisos do provedor (pago, repetido,
 * atrasado, estorno, contestação, estorno negado), reembolso em 7 dias, assinatura (ciclos,
 * cancelamento, curso incluído depois), matrícula manual convivendo com a paga, notas fiscais,
 * concorrência e a rota /api/webhooks/asaas (token).
 */
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as asaasWebhookRoute } from "@/app/api/webhooks/asaas/route";
import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";
import { getEnrollmentStatus } from "@/modules/enrollment/access";
import { getEnrollment } from "@/modules/enrollment/enrollment.server";
import { grantEnrollment, revokeEnrollment } from "@/modules/enrollment/grant";
import { syncAllSubscribers } from "@/modules/payments/access-sync.server";
import { createOrder, startSubscription } from "@/modules/payments/checkout.server";
import { buildFakePaymentEvent } from "@/modules/payments/provider/fake/fake-events";
import { cancelSubscription, requestOrderRefund } from "@/modules/payments/refunds.server";
import { simulateNextCycle, simulatePaymentAction } from "@/modules/payments/simulator.server";
import { receiveWebhook } from "@/modules/payments/webhook.server";

const CPF = "529.982.247-25";
const OTHER_CPF = "111.444.777-35";
const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-09-29T15:00:00.000Z"); // 12:00 em Brasília
const at = (days: number, hours = 0) => new Date(T0.getTime() + days * DAY + hours * 60 * 60 * 1000);
const WEBHOOK_TOKEN = "token-do-webhook-apenas-para-os-testes-0123456789";

async function resetSales() {
  await prisma.fiscalInvoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.billingProfile.deleteMany();
  await prisma.product.deleteMany();
  await prisma.plan.deleteMany();
}

async function resetAll() {
  await resetSales();
  await prisma.user.deleteMany();
  await prisma.course.deleteMany({ where: { slug: { startsWith: "teste-vendas" } } });
}

const buyer = (id: string) => ({ id, name: `Aluno ${id}`, email: `${id}@exemplo.com` });

async function createUser(id: string, role: "STUDENT" | "ADMIN" = "STUDENT") {
  return prisma.user.create({ data: { id, name: `Aluno ${id}`, email: `${id}@exemplo.com`, role } });
}

async function createCourse(slug: string, includedInSubscription = false) {
  return prisma.course.create({
    data: { slug: `teste-vendas-${slug}`, title: slug, description: "", isPublished: true, includedInSubscription },
  });
}

async function createProduct(slug: string, courseIds: string[], options: { accessDays?: number | null; priceCents?: number } = {}) {
  return prisma.product.create({
    data: {
      slug,
      title: `Produto ${slug}`,
      priceCents: options.priceCents ?? 9790,
      accessDays: options.accessDays === undefined ? 365 : options.accessDays,
      maxInstallments: 3,
      isActive: true,
      courses: { create: courseIds.map((courseId) => ({ courseId })) },
    },
  });
}

async function buy(
  userId: string,
  productSlug: string,
  options: { method?: "PIX" | "BOLETO" | "CREDIT_CARD"; installments?: number; cpf?: string; now?: Date } = {},
) {
  return createOrder({
    buyer: buyer(userId),
    productSlug,
    method: options.method ?? "PIX",
    installments: options.installments ?? 1,
    billing: { cpf: options.cpf ?? CPF, phone: null },
    now: options.now ?? T0,
  });
}

async function statusOf(userId: string, courseId: string, now: Date) {
  return getEnrollmentStatus(await getEnrollment(userId, courseId, now), now);
}

beforeAll(async () => {
  // Os e-mails simulados (sem Resend) seriam impressos no terminal; aqui só atrapalham a leitura.
  vi.spyOn(console, "info").mockImplementation(() => {});
});

beforeEach(async () => {
  await resetAll();
});

afterAll(async () => {
  await resetAll();
  vi.restoreAllMocks();
});

describe("compra avulsa", () => {
  it("cobrança criada NÃO libera acesso; o aviso de pagamento libera (com nota fiscal)", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    await createProduct("curso-a", [course.id]);

    const { orderId, paymentId } = await buy("aluno", "curso-a");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true, courses: true } });
    expect(order).toMatchObject({ status: "PENDING", provider: "FAKE", priceCents: 9790, accessDays: 365 });
    expect(order.courses.map((item) => item.courseId)).toEqual([course.id]);
    expect(order.payments).toHaveLength(1);
    expect(order.providerPaymentId).toBe(order.payments[0].providerPaymentId);
    expect(await statusOf("aluno", course.id, T0)).toBe("NONE");

    // O "Asaas" avisa: pago.
    const outcome = await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(0, 1) });
    expect(outcome.status).toBe("processed");
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(paid.status).toBe("PAID");
    expect(paid.paidAt).toEqual(at(0, 1));

    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId_source: { userId: "aluno", courseId: course.id, source: "PURCHASE" } },
    });
    expect(enrollment).toMatchObject({ startsAt: at(0, 1), expiresAt: at(365, 1), revokedAt: null });
    expect(await statusOf("aluno", course.id, at(1))).toBe("ACTIVE");

    const invoice = await prisma.fiscalInvoice.findUniqueOrThrow({ where: { paymentId: paymentId as string } });
    expect(invoice.status).toBe("AUTHORIZED");
  });

  it("o mesmo aviso duas vezes é processado uma vez só (idempotência)", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    await createProduct("curso-a", [course.id]);
    const { paymentId } = await buy("aluno", "curso-a");
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId as string }, include: { order: true } });

    const body = buildFakePaymentEvent({
      eventId: "evt_repetido",
      action: "PAY",
      charge: {
        providerPaymentId: payment.providerPaymentId,
        method: "PIX",
        valueCents: payment.valueCents,
        dueDate: "2026-09-30",
        externalReference: payment.orderId,
        installmentId: null,
        installmentNumber: null,
        subscriptionId: null,
        invoiceUrl: payment.invoiceUrl,
      },
      now: at(0, 1),
    });
    const first = await receiveWebhook({ provider: "FAKE", body, now: at(0, 1) });
    const second = await receiveWebhook({ provider: "FAKE", body, now: at(0, 2) });
    expect(first).toMatchObject({ ok: true, outcome: { status: "processed" } });
    expect(second).toMatchObject({ ok: true, outcome: { status: "duplicate" } });
    expect(await prisma.webhookEvent.count()).toBe(1);
    expect(await prisma.fiscalInvoice.count()).toBe(1);
  });

  it("aviso atrasado (mais antigo que o último aplicado) não desfaz o pagamento", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    await createProduct("curso-a", [course.id]);
    const { paymentId } = await buy("aluno", "curso-a");

    await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(0, 2) });
    const late = await simulatePaymentAction({ paymentId: paymentId as string, action: "OVERDUE", now: at(0, 1) });
    expect(late).toMatchObject({ status: "processed", note: expect.stringMatching(/mais antigo/) });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: paymentId as string } })).toMatchObject({ status: "RECEIVED" });
    expect(await statusOf("aluno", course.id, at(1))).toBe("ACTIVE");
  });

  it("recomprar com o acesso ativo SOMA os dias; o estorno de uma compra tira só os dias dela", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    await createUser("admin", "ADMIN");
    await createProduct("curso-a", [course.id]);

    const first = await buy("aluno", "curso-a");
    await simulatePaymentAction({ paymentId: first.paymentId as string, action: "PAY", now: at(0) });
    const second = await buy("aluno", "curso-a", { now: at(10) });
    await simulatePaymentAction({ paymentId: second.paymentId as string, action: "PAY", now: at(10) });

    const row = () =>
      prisma.enrollment.findUniqueOrThrow({
        where: { userId_courseId_source: { userId: "aluno", courseId: course.id, source: "PURCHASE" } },
      });
    expect((await row()).expiresAt).toEqual(at(730));

    // Admin estorna a SEGUNDA compra: volta a valer só a primeira (365 dias).
    await requestOrderRefund({ orderId: second.orderId, actor: { userId: "admin", isAdmin: true }, now: at(12) });
    expect((await row()).expiresAt).toEqual(at(365));
    expect(await statusOf("aluno", course.id, at(100))).toBe("ACTIVE");
  });

  it("parcelado no cartão: aprovado libera; contestação (chargeback) tira o acesso", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    await createProduct("curso-a", [course.id], { priceCents: 29700 });

    const { orderId, paymentId } = await buy("aluno", "curso-a", { method: "CREDIT_CARD", installments: 3 });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
    expect(order.installments).toBe(3);
    expect(order.providerInstallmentId).toMatch(/^ins_fake_/);
    expect(order.payments[0].valueCents).toBe(9900); // 1ª parcela

    await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(0, 1) });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: paymentId as string } })).toMatchObject({ status: "CONFIRMED" });
    expect(await statusOf("aluno", course.id, at(1))).toBe("ACTIVE");

    await simulatePaymentAction({ paymentId: paymentId as string, action: "CHARGEBACK", now: at(20) });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: "CHARGEBACK" });
    expect(await statusOf("aluno", course.id, at(21))).toBe("REVOKED");
    // A nota fiscal da cobrança contestada é cancelada.
    expect(await prisma.fiscalInvoice.findUniqueOrThrow({ where: { paymentId: paymentId as string } })).toMatchObject({
      status: "PROCESSING_CANCELLATION",
    });
  });

  it("parcelas: só as oferecidas para o produto; fora do cartão é sempre à vista", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    await createProduct("curso-a", [course.id], { priceCents: 1200 }); // R$ 12: no máximo 2x (parcela ≥ R$ 5)
    await expect(buy("aluno", "curso-a", { method: "CREDIT_CARD", installments: 3 })).rejects.toThrow(/parcelas/);
    const pix = await buy("aluno", "curso-a", { method: "PIX", installments: 3 });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: pix.orderId } })).toMatchObject({ installments: 1 });
  });

  it("produto inativo não é vendido; CPF inválido ou diferente do cadastrado é recusado", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    const product = await createProduct("curso-a", [course.id]);

    await expect(buy("aluno", "curso-a", { cpf: "123.456.789-00" })).rejects.toThrow(/CPF inválido/);
    await buy("aluno", "curso-a"); // grava o CPF
    const error = await buy("aluno", "curso-a", { cpf: OTHER_CPF }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UserFacingError);
    expect((error as UserFacingError).field).toBe("cpf");

    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
    await expect(buy("aluno", "curso-a")).rejects.toThrow(/não está à venda/);
  });

  it("limite de 10 pedidos novos por dia", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    await createProduct("curso-a", [course.id]);
    for (let index = 0; index < 10; index += 1) await buy("aluno", "curso-a");
    await expect(buy("aluno", "curso-a")).rejects.toThrow(/muitas compras hoje/);
  });

  it("cobrança criada fora do site é ignorada (sem erro)", async () => {
    const result = await receiveWebhook({
      provider: "FAKE",
      body: { id: "evt_fora", event: "PAYMENT_RECEIVED", payment: { id: "pay_de_fora", status: "RECEIVED", value: 10 } },
      now: T0,
    });
    expect(result).toMatchObject({ ok: true, outcome: { status: "processed", note: expect.stringMatching(/fora do site/) } });
  });
});

describe("reembolso (direito de arrependimento)", () => {
  it("aluno pede em até 7 dias: acesso sai na hora; estorno confirmado depois; negado devolve o acesso", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    await createProduct("curso-a", [course.id]);
    const { orderId, paymentId } = await buy("aluno", "curso-a");
    await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(0, 1) });

    const result = await requestOrderRefund({ orderId, actor: { userId: "aluno", isAdmin: false }, now: at(3) });
    expect(result).toEqual({ manualRefund: false });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({
      status: "REFUND_REQUESTED",
      refundRequestedBy: "STUDENT",
    });
    expect(await statusOf("aluno", course.id, at(3, 1))).toBe("REVOKED");

    // Pedir de novo: recusado.
    await expect(requestOrderRefund({ orderId, actor: { userId: "aluno", isAdmin: false }, now: at(3, 2) })).rejects.toThrow(
      /já foi pedido/,
    );

    // O provedor NEGA o estorno: a cobrança volta a paga e o acesso volta.
    await simulatePaymentAction({ paymentId: paymentId as string, action: "REFUND_DENIED", now: at(4) });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: "PAID" });
    expect(await statusOf("aluno", course.id, at(4, 1))).toBe("ACTIVE");
  });

  it("depois de 7 dias o aluno não consegue; outra pessoa não consegue; o admin consegue", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    await createUser("outro");
    await createUser("admin", "ADMIN");
    await createProduct("curso-a", [course.id]);
    const { orderId, paymentId } = await buy("aluno", "curso-a");
    await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(0) });

    await expect(requestOrderRefund({ orderId, actor: { userId: "aluno", isAdmin: false }, now: at(8) })).rejects.toThrow(/7 dias/);
    await expect(requestOrderRefund({ orderId, actor: { userId: "outro", isAdmin: false }, now: at(1) })).rejects.toThrow(
      /não encontrado/,
    );
    await requestOrderRefund({ orderId, actor: { userId: "admin", isAdmin: true }, now: at(30) });

    await simulatePaymentAction({ paymentId: paymentId as string, action: "REFUND", now: at(31) });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: "REFUNDED" });
    expect(await statusOf("aluno", course.id, at(32))).toBe("REVOKED");
  });

  it("boleto: o estorno é manual (avisado), mas o acesso sai do mesmo jeito", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    await createProduct("curso-a", [course.id]);
    const { orderId, paymentId } = await buy("aluno", "curso-a", { method: "BOLETO" });
    await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(1) });

    const result = await requestOrderRefund({ orderId, actor: { userId: "aluno", isAdmin: false }, now: at(2) });
    expect(result).toEqual({ manualRefund: true });
    expect(await statusOf("aluno", course.id, at(2, 1))).toBe("REVOKED");
  });
});

describe("matrícula manual convive com a paga", () => {
  it("revogar a manual não tira a comprada; estornar a compra não tira a manual", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    await createUser("admin", "ADMIN");
    await createProduct("curso-a", [course.id]);

    await grantEnrollment(prisma, { userId: "aluno", courseId: course.id, days: null, now: T0 });
    const { orderId, paymentId } = await buy("aluno", "curso-a");
    await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(0, 1) });

    await revokeEnrollment(prisma, { userId: "aluno", courseId: course.id, now: at(1) });
    expect(await statusOf("aluno", course.id, at(2))).toBe("ACTIVE"); // a compra continua

    await grantEnrollment(prisma, { userId: "aluno", courseId: course.id, days: null, now: at(3) });
    await requestOrderRefund({ orderId, actor: { userId: "admin", isAdmin: true }, now: at(4) });
    expect(await statusOf("aluno", course.id, at(5))).toBe("ACTIVE"); // a manual continua
  });
});

describe("assinatura", () => {
  async function setupPlan() {
    const included = await createCourse("incluido", true);
    const outside = await createCourse("fora", false);
    await prisma.plan.create({
      data: { slug: "mensal", title: "Plano mensal", priceCents: 4990, cycle: "MONTHLY", isActive: true },
    });
    return { included, outside };
  }

  it("1º pagamento ativa e libera os cursos incluídos até o fim do ciclo (+5 dias)", async () => {
    const { included, outside } = await setupPlan();
    await createUser("aluno");
    const { subscriptionId, paymentId } = await startSubscription({
      buyer: buyer("aluno"),
      planSlug: "mensal",
      method: "CREDIT_CARD",
      billing: { cpf: CPF, phone: "11999998888" },
      now: T0,
    });
    expect(await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } })).toMatchObject({
      status: "PENDING",
      provider: "FAKE",
    });
    expect(paymentId).not.toBeNull();

    await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(0, 1) });
    expect(await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } })).toMatchObject({ status: "ACTIVE" });
    // Vencimento da 1ª cobrança (cartão): 30/09 → vale até 30/10 + 5 dias = 04/11 00:00 (Brasília).
    const row = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId_source: { userId: "aluno", courseId: included.id, source: "SUBSCRIPTION" } },
    });
    expect(row.expiresAt?.toISOString()).toBe("2026-11-04T03:00:00.000Z");
    expect(await statusOf("aluno", outside.id, at(1))).toBe("NONE");
  });

  it("ciclo seguinte pago estende; cancelar mantém o período pago; nova assinatura bloqueada enquanto ativa", async () => {
    const { included } = await setupPlan();
    await createUser("aluno");
    const { subscriptionId, paymentId } = await startSubscription({
      buyer: buyer("aluno"),
      planSlug: "mensal",
      method: "PIX",
      billing: { cpf: CPF, phone: null },
      now: T0,
    });
    await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(0, 1) });
    await expect(
      startSubscription({ buyer: buyer("aluno"), planSlug: "mensal", method: "PIX", billing: { cpf: CPF, phone: null }, now: at(1) }),
    ).rejects.toThrow(/já tem uma assinatura ativa/);

    // O "Asaas" gera a cobrança do próximo ciclo (31/10) e ela é paga.
    await simulateNextCycle({ subscriptionId, now: at(25) });
    const next = await prisma.payment.findFirstOrThrow({ where: { subscriptionId, status: "PENDING" } });
    expect(next.dueDate.toISOString().slice(0, 10)).toBe("2026-10-30");
    await simulatePaymentAction({ paymentId: next.id, action: "PAY", now: at(30) });
    const row = () =>
      prisma.enrollment.findUniqueOrThrow({
        where: { userId_courseId_source: { userId: "aluno", courseId: included.id, source: "SUBSCRIPTION" } },
      });
    expect((await row()).expiresAt?.toISOString()).toBe("2026-12-05T03:00:00.000Z");

    // Cancelar: não gera mais cobranças, mas o período pago continua valendo.
    await cancelSubscription({ subscriptionId, actor: { userId: "aluno", isAdmin: false }, now: at(40) });
    expect(await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } })).toMatchObject({ status: "CANCELED" });
    expect(await statusOf("aluno", included.id, at(60))).toBe("ACTIVE");
    expect(await statusOf("aluno", included.id, at(70))).toBe("EXPIRED");
    // Reembolso pelo aluno: só o 1º pagamento em 7 dias (aqui já são 2 pagamentos).
    await expect(
      cancelSubscription({ subscriptionId, actor: { userId: "aluno", isAdmin: false }, refund: true, now: at(41) }),
    ).rejects.toThrow(/já está cancelada/);
  });

  it("arrependimento na assinatura: cancela e reembolsa o 1º pagamento (acesso sai na hora)", async () => {
    const { included } = await setupPlan();
    await createUser("aluno");
    const { subscriptionId, paymentId } = await startSubscription({
      buyer: buyer("aluno"),
      planSlug: "mensal",
      method: "CREDIT_CARD",
      billing: { cpf: CPF, phone: null },
      now: T0,
    });
    await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(0, 1) });

    const result = await cancelSubscription({ subscriptionId, actor: { userId: "aluno", isAdmin: false }, refund: true, now: at(2) });
    expect(result).toEqual({ refunded: true, manualRefund: false });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: paymentId as string } })).toMatchObject({
      status: "REFUND_REQUESTED",
    });
    expect(await statusOf("aluno", included.id, at(2, 1))).toBe("REVOKED");
  });

  it("curso incluído DEPOIS na assinatura: quem está em dia ganha o acesso na hora", async () => {
    await setupPlan();
    const later = await createCourse("depois", false);
    await createUser("aluno");
    const { paymentId } = await startSubscription({
      buyer: buyer("aluno"),
      planSlug: "mensal",
      method: "PIX",
      billing: { cpf: CPF, phone: null },
      now: T0,
    });
    await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(0, 1) });
    expect(await statusOf("aluno", later.id, at(1))).toBe("NONE");

    await prisma.course.update({ where: { id: later.id }, data: { includedInSubscription: true } });
    expect(await syncAllSubscribers(at(2))).toBe(1);
    expect(await statusOf("aluno", later.id, at(3))).toBe("ACTIVE");
  });
});

describe("concorrência", () => {
  it("dois pagamentos do mesmo aluno processados AO MESMO TEMPO: os dois contam", async () => {
    const course = await createCourse("a");
    await createUser("aluno");
    await createProduct("curso-a", [course.id]);
    const first = await buy("aluno", "curso-a");
    const second = await buy("aluno", "curso-a");

    await Promise.all([
      simulatePaymentAction({ paymentId: first.paymentId as string, action: "PAY", now: at(0, 1) }),
      simulatePaymentAction({ paymentId: second.paymentId as string, action: "PAY", now: at(0, 1) }),
    ]);
    const row = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId_source: { userId: "aluno", courseId: course.id, source: "PURCHASE" } },
    });
    expect(row.expiresAt).toEqual(at(730, 1));
    // Uma nota fiscal por cobrança (nunca duplicada).
    expect(await prisma.fiscalInvoice.count()).toBe(2);
  });
});

describe("rota /api/webhooks/asaas", () => {
  const request = (headers: Record<string, string>, body: string) =>
    new NextRequest("http://localhost:3000/api/webhooks/asaas", { method: "POST", headers, body });
  const validBody = JSON.stringify({ id: "evt_rota", event: "PAYMENT_CREATED", payment: { id: "pay_x", status: "PENDING" } });

  it("sem o token certo: 401 (ninguém finge um pagamento)", async () => {
    expect((await asaasWebhookRoute(request({}, validBody))).status).toBe(401);
    expect((await asaasWebhookRoute(request({ "asaas-access-token": "errado" }, validBody))).status).toBe(401);
    expect(await prisma.webhookEvent.count()).toBe(0);
  });

  it("com o token: 400 para corpo inválido; 200 para aviso válido (gravado uma vez só)", async () => {
    const headers = { "asaas-access-token": WEBHOOK_TOKEN, "content-type": "application/json" };
    expect((await asaasWebhookRoute(request(headers, "não é json"))).status).toBe(400);
    expect((await asaasWebhookRoute(request(headers, JSON.stringify({ event: "X" })))).status).toBe(400);

    const ok = await asaasWebhookRoute(request(headers, validBody));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ received: true, status: "processed" });
    const again = await asaasWebhookRoute(request(headers, validBody));
    expect(await again.json()).toEqual({ received: true, status: "duplicate" });
    expect(await prisma.webhookEvent.count()).toBe(1);
  });
});
