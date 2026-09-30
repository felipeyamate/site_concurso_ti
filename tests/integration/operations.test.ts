/**
 * operations.test.ts — Testes de integração da Fase 7 (produção): as tarefas agendadas — conferir
 * no provedor as cobranças em aberto (aviso perdido) e a limpeza diária — e a proteção das rotas
 * de tarefa. Com PostgreSQL de verdade e o provedor de pagamento SIMULADO.
 *
 * Rodar: npm run test:integration   (exige TEST_DATABASE_URL — ver README)
 */
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as cleanupRoute } from "@/app/api/cron/limpeza/route";
import { GET as reconcileRoute } from "@/app/api/cron/conferir-pagamentos/route";
import { prisma } from "@/lib/db";
import { cleanupExpiredRecords } from "@/modules/maintenance/cleanup.server";
import { createOrder } from "@/modules/payments/checkout.server";
import { getPaymentProvider } from "@/modules/payments/provider/provider.server";
import type { PaymentProvider } from "@/modules/payments/provider/types";
import { reconcileOpenPayments } from "@/modules/payments/reconcile.server";

const T0 = new Date("2026-10-01T15:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => new Date(T0.getTime() + hours * HOUR);

function fakeProvider(): PaymentProvider {
  const provider = getPaymentProvider();
  if (!provider || provider.kind !== "FAKE") throw new Error("Os testes esperam o provedor simulado.");
  return provider;
}

async function reset() {
  const users = { userId: { startsWith: "op-" } };
  await prisma.fiscalInvoice.deleteMany({ where: { payment: { order: users } } });
  await prisma.payment.deleteMany({ where: { order: users } });
  await prisma.order.deleteMany({ where: users });
  await prisma.billingProfile.deleteMany({ where: users });
  await prisma.enrollment.deleteMany({ where: users });
  await prisma.session.deleteMany({ where: users });
  await prisma.user.deleteMany({ where: { id: { startsWith: "op-" } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: "op-" } } });
  await prisma.course.deleteMany({ where: { slug: { startsWith: "teste-operacoes" } } });
  await prisma.verification.deleteMany({ where: { identifier: { startsWith: "op-" } } });
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "op-" } } });
}

async function setupPendingOrder(userId: string) {
  await prisma.user.create({ data: { id: userId, name: userId, email: `${userId}@exemplo.com` } });
  const course = await prisma.course.findFirst({ where: { slug: "teste-operacoes" } }) ??
    (await prisma.course.create({ data: { slug: "teste-operacoes", title: "Curso", description: "", isPublished: true } }));
  if (!(await prisma.product.findUnique({ where: { slug: "op-produto" } }))) {
    await prisma.product.create({
      data: { slug: "op-produto", title: "Produto", priceCents: 9700, isActive: true, courses: { create: [{ courseId: course.id }] } },
    });
  }
  const order = await createOrder({
    buyer: { id: userId, name: userId, email: `${userId}@exemplo.com` },
    productSlug: "op-produto",
    method: "PIX",
    installments: 1,
    billing: { cpf: "529.982.247-25", phone: null },
    now: T0,
  });
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: order.paymentId as string } });
  return { order, payment, courseId: course.id };
}

beforeAll(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});

beforeEach(async () => {
  await reset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterAll(async () => {
  await reset();
});

describe("conferência automática das cobranças (aviso perdido)", () => {
  it("descobre um pagamento cujo aviso se perdeu, libera o acesso e só confere de novo depois de 1 hora", async () => {
    const { order, payment, courseId } = await setupPendingOrder("op-aluna");
    // O provedor diz: paga (o aviso nunca chegou).
    vi.spyOn(fakeProvider(), "getCharge").mockResolvedValue({
      paymentId: payment.providerPaymentId,
      installmentId: null,
      subscriptionId: null,
      externalReference: order.orderId,
      method: "PIX",
      status: "RECEIVED",
      providerStatus: "RECEIVED",
      valueCents: payment.valueCents,
      dueDate: "2026-10-02",
      installmentNumber: null,
      invoiceUrl: null,
      bankSlipUrl: null,
      paidDate: "2026-10-01",
      refundDenied: false,
    });

    expect(await reconcileOpenPayments({ now: at(1) })).toMatchObject({ checked: 1, failed: 0 });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } })).toMatchObject({ status: "PAID" });
    expect(await prisma.enrollment.count({ where: { userId: "op-aluna", courseId, revokedAt: null } })).toBe(1);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).providerCheckedAt).toEqual(at(1));
    // Paga: sai da fila (e nada mais é conferido).
    expect(await reconcileOpenPayments({ now: at(3) })).toMatchObject({ checked: 0 });
  });

  it("cobrança que o provedor não consegue informar: conta a falha, marca a hora e não trava a fila", async () => {
    const first = await setupPendingOrder("op-um");
    const second = await setupPendingOrder("op-dois");
    const spy = vi.spyOn(fakeProvider(), "getCharge").mockImplementation(async (providerPaymentId) => {
      if (providerPaymentId === first.payment.providerPaymentId) throw new Error("provedor fora do ar");
      return {
        paymentId: providerPaymentId,
        installmentId: null,
        subscriptionId: null,
        externalReference: second.order.orderId,
        method: "PIX",
        status: "PENDING",
        providerStatus: "PENDING",
        valueCents: second.payment.valueCents,
        dueDate: "2026-10-02",
        installmentNumber: null,
        invoiceUrl: null,
        bankSlipUrl: null,
        paidDate: null,
        refundDenied: false,
      };
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await reconcileOpenPayments({ now: at(1) })).toMatchObject({ checked: 1, failed: 1 });
    expect(errors).toHaveBeenCalled();
    // Dentro de 1 hora ninguém é conferido de novo; depois, as duas voltam para a fila.
    expect(await reconcileOpenPayments({ now: at(1.5) })).toMatchObject({ checked: 0, failed: 0 });
    spy.mockClear();
    await reconcileOpenPayments({ now: at(2.5) });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("vencidas continuam na fila; as vencidas há mais de 7 dias (Pix abandonado) só 1 vez por dia", async () => {
    const abandoned = await setupPendingOrder("op-abandonado");
    const recent = await setupPendingOrder("op-recente");
    const boleto = await setupPendingOrder("op-boleto");
    const day = (days: number) => new Date(Date.UTC(2026, 9, 1 + days)); // coluna de data (dia de Brasília)
    await prisma.payment.update({ where: { id: abandoned.payment.id }, data: { status: "OVERDUE", dueDate: day(-10) } });
    await prisma.payment.update({ where: { id: recent.payment.id }, data: { status: "OVERDUE", dueDate: day(-4) } });
    await prisma.payment.update({ where: { id: boleto.payment.id }, data: { status: "OVERDUE", method: "BOLETO", dueDate: day(-2) } });
    const spy = vi.spyOn(fakeProvider(), "getCharge").mockRejectedValue(new Error("só contando as consultas"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const askedAt = async (now: Date) => {
      spy.mockClear();
      await reconcileOpenPayments({ now });
      return spy.mock.calls.map(([providerPaymentId]) => providerPaymentId).sort();
    };
    const all = [abandoned, recent, boleto].map((item) => item.payment.providerPaymentId).sort();

    // Primeira rodada: todas (nunca foram conferidas).
    expect(await askedAt(at(1))).toEqual(all);
    // 2 horas depois: as recentes de novo (inclusive o Pix vencido há 4 dias, na tolerância); a abandonada não.
    expect(await askedAt(at(3))).toEqual([recent, boleto].map((item) => item.payment.providerPaymentId).sort());
    // 1 dia depois: a abandonada volta.
    expect(await askedAt(at(26))).toEqual(all);
  });
});

describe("limpeza diária", () => {
  it("apaga só logins, códigos, contadores e registros de acesso vencidos", async () => {
    await prisma.user.create({ data: { id: "op-aluna", name: "Aluna", email: "op-aluna@exemplo.com" } });
    await prisma.session.createMany({
      data: [
        { id: "op-vencida", token: "op-t1", userId: "op-aluna", expiresAt: at(-30) },
        { id: "op-valida", token: "op-t2", userId: "op-aluna", expiresAt: at(24) },
      ],
    });
    await prisma.verification.createMany({
      data: [
        { id: "op-v1", identifier: "op-velho", value: "x", expiresAt: at(-1) },
        { id: "op-v2", identifier: "op-novo", value: "x", expiresAt: at(1) },
      ],
    });
    await prisma.rateLimit.createMany({
      data: [
        { id: "op-r1", key: "op-antigo", count: 3, lastRequest: BigInt(at(-48).getTime()) },
        { id: "op-r2", key: "op-recente", count: 1, lastRequest: BigInt(at(-1).getTime()) },
      ],
    });
    // Registro de acesso (Marco Civil): o de 187 dias passou dos 6 meses; o de 170 dias ainda não.
    await prisma.accessLog.createMany({
      data: [
        { id: "op-a1", userId: "op-aluna", ipAddress: "203.0.113.1", createdAt: at(-187 * 24) },
        { id: "op-a2", userId: "op-aluna", ipAddress: "203.0.113.2", createdAt: at(-170 * 24) },
      ],
    });
    const result = await cleanupExpiredRecords(T0);
    expect(result.sessions).toBeGreaterThanOrEqual(1);
    expect(await prisma.accessLog.findMany({ where: { userId: "op-aluna" }, select: { id: true } })).toEqual([{ id: "op-a2" }]);
    expect(await prisma.session.findMany({ where: { userId: "op-aluna" }, select: { id: true } })).toEqual([{ id: "op-valida" }]);
    expect(await prisma.verification.findMany({ where: { identifier: { startsWith: "op-" } }, select: { id: true } })).toEqual([{ id: "op-v2" }]);
    expect(await prisma.rateLimit.findMany({ where: { key: { startsWith: "op-" } }, select: { id: true } })).toEqual([{ id: "op-r2" }]);
  });

  it("apaga o estudo que chegou DEPOIS da exclusão da conta (e só o de contas excluídas)", async () => {
    await prisma.user.createMany({
      data: [
        { id: "op-excluida", name: "Conta excluída", email: "op-excluida@excluida.invalid", deletedAt: at(-2) },
        { id: "op-ativa", name: "Aluna", email: "op-ativa@exemplo.com" },
      ],
    });
    const course = await prisma.course.create({ data: { slug: "teste-operacoes-curso", title: "Curso", description: "" } });
    const courseModule = await prisma.module.create({ data: { courseId: course.id, title: "Módulo", position: 1 } });
    const lesson = await prisma.lesson.create({ data: { courseId: course.id, moduleId: courseModule.id, slug: "op-aula", title: "Aula", position: 1 } });
    // Um progresso gravado depois da exclusão (estava "a caminho") e um de uma conta normal.
    await prisma.lessonProgress.createMany({
      data: [
        { userId: "op-excluida", lessonId: lesson.id, positionSeconds: 10, lastWatchedAt: at(-1) },
        { userId: "op-ativa", lessonId: lesson.id, positionSeconds: 20, lastWatchedAt: at(-1) },
      ],
    });
    const result = await cleanupExpiredRecords(T0);
    expect(result.deletedAccountsStudy).toBe(1);
    expect(await prisma.lessonProgress.findMany({ where: { lessonId: lesson.id }, select: { userId: true } })).toEqual([{ userId: "op-ativa" }]);
  });
});

describe("rotas das tarefas agendadas", () => {
  it("sem o segredo (CRON_SECRET), recusam com 401 e não fazem nada", async () => {
    for (const route of [reconcileRoute, cleanupRoute]) {
      const response = await route(new NextRequest("https://concursoti.test/api/cron/x", { headers: { authorization: "Bearer chute" } }));
      expect(response.status).toBe(401);
    }
  });
});
