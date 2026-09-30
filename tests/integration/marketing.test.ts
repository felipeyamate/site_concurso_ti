/**
 * marketing.test.ts — Testes de integração da Fase 6: cupons e afiliados, com PostgreSQL de verdade
 * e o provedor de pagamento SIMULADO.
 *
 * Rodar: npm run test:integration   (exige TEST_DATABASE_URL — ver README)
 *
 * O que está coberto: compra e assinatura com cupom (valor cobrado, "foto" no pedido, renovação com
 * desconto), cupom recusado antes de cadastrar o aluno no provedor, limites de uso (e concorrência
 * no último uso), painel de cupons; link de divulgação (cookie, destino seguro, cliques), quem fica
 * com a venda, comissões (carência, liberada, estorno, assinatura) e o registro de pagamento ao
 * afiliado (inclusive dois cliques ao mesmo tempo).
 */
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as referralRoute } from "@/app/r/[code]/route";
import { prisma } from "@/lib/db";
import { advisoryLock } from "@/lib/db-locks";
import { createAffiliate, listAffiliatesForAdmin, registerAffiliatePayout } from "@/modules/affiliates/affiliates-admin.server";
import { getAffiliateDashboard, getAffiliateForAdmin } from "@/modules/affiliates/affiliates.server";
import { AFFILIATE_COOKIE } from "@/modules/affiliates/rules";
import { deleteCoupon, saveCoupon } from "@/modules/coupons/coupons-admin.server";
import { couponFormSchema } from "@/modules/coupons/schemas";
import { createOrder, startSubscription } from "@/modules/payments/checkout.server";
import { requestOrderRefund } from "@/modules/payments/refunds.server";
import { simulateNextCycle, simulatePaymentAction } from "@/modules/payments/simulator.server";

const CPF = "529.982.247-25";
const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-10-01T15:00:00.000Z"); // 12:00 em Brasília
const at = (days: number, hours = 0) => new Date(T0.getTime() + days * DAY + hours * 60 * 60 * 1000);

async function resetMarketingAndSales() {
  await prisma.affiliatePayoutItem.deleteMany();
  await prisma.affiliatePayout.deleteMany();
  await prisma.fiscalInvoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.affiliate.deleteMany();
  await prisma.billingProfile.deleteMany();
  await prisma.product.deleteMany();
  await prisma.plan.deleteMany();
}

async function resetAll() {
  await resetMarketingAndSales();
  await prisma.user.deleteMany({ where: { id: { startsWith: "mk-" } } });
  await prisma.course.deleteMany({ where: { slug: { startsWith: "teste-marketing" } } });
}

const buyer = (id: string) => ({ id, name: `Aluno ${id}`, email: `${id}@exemplo.com` });

async function createUser(id: string) {
  return prisma.user.create({ data: { id, name: `Pessoa ${id}`, email: `${id}@exemplo.com` } });
}

async function setupCatalog() {
  const course = await prisma.course.create({
    data: { slug: "teste-marketing-base", title: "Curso base", description: "", isPublished: true, includedInSubscription: true },
  });
  const product = await prisma.product.create({
    data: {
      slug: "curso-base",
      title: "Curso Base — 12 meses",
      priceCents: 19700,
      accessDays: 365,
      maxInstallments: 12,
      isActive: true,
      courses: { create: [{ courseId: course.id }] },
    },
  });
  const plan = await prisma.plan.create({ data: { slug: "mensal", title: "Plano mensal", priceCents: 4990, cycle: "MONTHLY", isActive: true } });
  return { course, product, plan };
}

type CouponInput = Partial<Record<string, unknown>>;
async function createCoupon(input: CouponInput = {}) {
  const data = couponFormSchema.parse({
    code: "BEMVINDO10",
    description: "",
    discountType: "PERCENT",
    percentOff: "10",
    appliesToProducts: "on",
    maxPerUser: "1",
    isActive: "on",
    ...input,
  });
  return saveCoupon(data);
}

function buy(userId: string, options: { couponCode?: string; affiliateCode?: string; now?: Date; installments?: number; method?: "PIX" | "CREDIT_CARD" } = {}) {
  return createOrder({
    buyer: buyer(userId),
    productSlug: "curso-base",
    method: options.method ?? "PIX",
    installments: options.installments ?? 1,
    billing: { cpf: CPF, phone: null },
    couponCode: options.couponCode ?? null,
    affiliateCode: options.affiliateCode ?? null,
    now: options.now ?? T0,
  });
}

beforeAll(() => {
  vi.spyOn(console, "info").mockImplementation(() => {}); // e-mails simulados
});

beforeEach(async () => {
  await resetAll();
});

afterAll(async () => {
  await resetAll();
});

describe("cupons no checkout", () => {
  it("compra com cupom: cobra o preço com desconto e o pedido guarda a 'foto'", async () => {
    await setupCatalog();
    await createUser("mk-aluno");
    await createCoupon();
    const { orderId, paymentId } = await buy("mk-aluno", { couponCode: " bemvindo10 " });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({
      priceCents: 17730,
      discountCents: 1970,
      couponCode: "BEMVINDO10",
    });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: paymentId as string } })).toMatchObject({ valueCents: 17730 });
  });

  it("cupom que não vale: recusa ANTES de cadastrar o aluno no provedor (o CPF não fica travado)", async () => {
    await setupCatalog();
    await createUser("mk-aluno");
    await expect(buy("mk-aluno", { couponCode: "NAOEXISTE" })).rejects.toThrow(/não existe/);
    await createCoupon({ appliesToProducts: undefined, appliesToPlans: "on" });
    await expect(buy("mk-aluno", { couponCode: "BEMVINDO10" })).rejects.toThrow(/não vale para esta compra/);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.billingProfile.count()).toBe(0);
  });

  it("limites: aguardando pagamento reserva o uso; vencido ou cancelado devolve; pago conta mesmo reembolsado", async () => {
    await setupCatalog();
    await createUser("mk-aluno");
    await createUser("mk-outro");
    await createCoupon({ maxRedemptions: "1" });
    const first = await buy("mk-aluno", { couponCode: "BEMVINDO10" });
    // Pix gerado e ainda não pago = reserva: o próprio aluno recebe "aguardando pagamento"; o outro, "esgotado".
    await expect(buy("mk-aluno", { couponCode: "BEMVINDO10", now: at(0, 1) })).rejects.toThrow(/aguardando pagamento/);
    await expect(buy("mk-outro", { couponCode: "BEMVINDO10", now: at(0, 1) })).rejects.toThrow(/número máximo/);
    // O Pix vence sem pagamento → o uso volta (antes, um Pix esquecido travava o cupom para sempre).
    await simulatePaymentAction({ paymentId: first.paymentId as string, action: "OVERDUE", now: at(1, 1) });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: first.orderId } })).toMatchObject({ status: "OVERDUE" });
    const second = await buy("mk-outro", { couponCode: "BEMVINDO10", now: at(1, 2) });
    // Pago e reembolsado continua contando (senão: comprar, pedir reembolso e comprar de novo com o cupom).
    await simulatePaymentAction({ paymentId: second.paymentId as string, action: "PAY", now: at(1, 3) });
    await requestOrderRefund({ orderId: second.orderId, actor: { userId: "mk-outro", isAdmin: false }, now: at(1, 4) });
    await expect(buy("mk-outro", { couponCode: "BEMVINDO10", now: at(1, 5) })).rejects.toThrow(/já usou/);
    await expect(buy("mk-aluno", { couponCode: "BEMVINDO10", now: at(1, 5) })).rejects.toThrow(/número máximo/);

    // Cobrança removida (pedido cancelado) também devolve o uso.
    await createCoupon({ code: "UMAVEZ", maxRedemptions: "1" });
    const removed = await buy("mk-aluno", { couponCode: "UMAVEZ", now: at(2) });
    await simulatePaymentAction({ paymentId: removed.paymentId as string, action: "DELETE", now: at(2, 1) });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: removed.orderId } })).toMatchObject({ status: "CANCELED" });
    await expect(buy("mk-outro", { couponCode: "UMAVEZ", now: at(2, 2) })).resolves.toHaveProperty("orderId");
  });

  it("dois alunos AO MESMO TEMPO no último uso: só um leva (trava do cupom)", async () => {
    await setupCatalog();
    await createUser("mk-a1");
    await createUser("mk-a2");
    await createUser("mk-a3");
    await createCoupon({ maxRedemptions: "1" });
    const results = await Promise.allSettled(["mk-a1", "mk-a2", "mk-a3"].map((id) => buy(id, { couponCode: "BEMVINDO10" })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.order.count({ where: { couponCode: "BEMVINDO10" } })).toBe(1);
  });

  it("assinatura com cupom: desconto na 1ª cobrança e nas renovações", async () => {
    await setupCatalog();
    await createUser("mk-aluno");
    await createCoupon({ code: "ASSINA20", percentOff: "20", appliesToProducts: undefined, appliesToPlans: "on" });
    const { subscriptionId, paymentId } = await startSubscription({
      buyer: buyer("mk-aluno"),
      planSlug: "mensal",
      method: "PIX",
      billing: { cpf: CPF, phone: null },
      couponCode: "assina20",
      now: T0,
    });
    expect(await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } })).toMatchObject({ priceCents: 3992, discountCents: 998 });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: paymentId as string } })).toMatchObject({ valueCents: 3992 });
    await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(0, 1) });
    await simulateNextCycle({ subscriptionId, now: at(25) });
    const cycles = await prisma.payment.findMany({ where: { subscriptionId }, select: { valueCents: true } });
    expect(cycles.map((payment) => payment.valueCents)).toEqual([3992, 3992]);
  });

  it("painel: código único; código de cupom usado não muda; cupom usado não se apaga", async () => {
    await setupCatalog();
    await createUser("mk-aluno");
    const { id } = await createCoupon();
    await expect(createCoupon()).rejects.toThrow(/Já existe um cupom/);
    await buy("mk-aluno", { couponCode: "BEMVINDO10" });
    const edit = couponFormSchema.parse({ couponId: id, code: "OUTRO10", description: "", discountType: "PERCENT", percentOff: "15", appliesToProducts: "on", maxPerUser: "1" });
    await expect(saveCoupon(edit)).rejects.toThrow(/o código não muda/);
    await saveCoupon({ ...edit, code: "BEMVINDO10" }); // mudar o desconto pode
    expect(await prisma.coupon.findUniqueOrThrow({ where: { id } })).toMatchObject({ discountValue: 15, isActive: false });
    await expect(deleteCoupon(id)).rejects.toThrow(/desative/);
    const unused = await createCoupon({ code: "NUNCAUSADO" });
    await deleteCoupon(unused.id);
    expect(await prisma.coupon.findUnique({ where: { id: unused.id } })).toBeNull();
  });

  it("painel: trocar o código ESPERA a compra com o cupom que está sendo gravada (a mesma trava do checkout)", async () => {
    const { product } = await setupCatalog();
    await createUser("mk-aluno");
    const { id } = await createCoupon();
    // Uma "compra" pega a trava do cupom (como o checkout faz) e só grava o pedido quando liberarmos.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let signalLocked: () => void = () => {};
    const locked = new Promise<void>((resolve) => (signalLocked = resolve));
    const purchase = prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `coupon:${id}`);
      signalLocked();
      await gate;
      await tx.order.create({
        data: {
          userId: "mk-aluno",
          productId: product.id,
          productTitle: product.title,
          priceCents: 17730,
          discountCents: 1970,
          couponId: id,
          couponCode: "BEMVINDO10",
          method: "PIX",
          provider: "FAKE",
        },
      });
    });
    await locked;
    const edit = couponFormSchema.parse({ couponId: id, code: "OUTRO10", description: "", discountType: "PERCENT", percentOff: "10", appliesToProducts: "on", maxPerUser: "1", isActive: "on" });
    const rename = saveCoupon(edit);
    const early = await Promise.race([
      rename.then(
        () => "gravou",
        () => "falhou",
      ),
      new Promise((resolve) => setTimeout(() => resolve("esperando"), 300)),
    ]);
    expect(early).toBe("esperando"); // sem a trava, o código mudava aqui (a compra ainda não aparecia)
    release();
    await purchase;
    await expect(rename).rejects.toThrow(/o código não muda/);
    expect(await prisma.coupon.findUniqueOrThrow({ where: { id } })).toMatchObject({ code: "BEMVINDO10" });
  });
});

describe("afiliados", () => {
  async function setupAffiliate(code = "joao", commission = "20") {
    await createUser("mk-joao");
    return createAffiliate({ email: "mk-joao@exemplo.com", code, commissionBps: Number(commission) * 100, payoutInfo: "Pix: joao@exemplo.com" });
  }

  function hitReferral(path: string) {
    const url = new URL(path, "https://concursoti.test");
    const code = url.pathname.split("/")[2];
    return referralRoute(new NextRequest(url), { params: Promise.resolve({ code }) });
  }

  it("link /r/<código>: cookie de 30 dias, destino só do site e clique contado", async () => {
    const { id } = await setupAffiliate();
    const response = await hitReferral("/r/Joao?para=/cursos/base");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://concursoti.test/cursos/base");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${AFFILIATE_COOKIE}=joao`);
    expect(cookie).toMatch(/Max-Age=2592000/);
    expect(cookie).toMatch(/HttpOnly/i);

    const evil = await hitReferral("/r/joao?para=https://site-falso.com");
    expect(evil.headers.get("location")).toBe("https://concursoti.test/");
    expect((await prisma.affiliateClickDay.findMany({ where: { affiliateId: id } })).reduce((sum, day) => sum + day.clicks, 0)).toBe(2);

    await prisma.affiliate.update({ where: { id }, data: { isActive: false } });
    expect((await hitReferral("/r/joao")).headers.get("set-cookie")).toBeNull();
    expect((await hitReferral("/r/nao-existe")).headers.get("set-cookie")).toBeNull();
  });

  it("quem fica com a venda: link, cupom do afiliado (ganha do link) e nunca o próprio afiliado", async () => {
    await setupCatalog();
    const joao = await setupAffiliate();
    await createUser("mk-maria");
    const maria = await createAffiliate({ email: "mk-maria@exemplo.com", code: "maria", commissionBps: 1500, payoutInfo: "" });
    await createCoupon({ code: "MARIA10", affiliateId: maria.id, maxPerUser: "5" });
    await createUser("mk-aluno");

    const byLink = await buy("mk-aluno", { affiliateCode: "joao" });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: byLink.orderId } })).toMatchObject({ affiliateId: joao.id, affiliateCommissionBps: 2000 });
    const byCoupon = await buy("mk-aluno", { affiliateCode: "joao", couponCode: "MARIA10", now: at(0, 1) });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: byCoupon.orderId } })).toMatchObject({ affiliateId: maria.id, affiliateCommissionBps: 1500 });
    const self = await buy("mk-joao", { affiliateCode: "joao", now: at(0, 2) });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: self.orderId } })).toMatchObject({ affiliateId: null, affiliateCommissionBps: null });
  });

  it("comissões: carência de 7 dias, liberada, paga uma vez só; estorno cancela", async () => {
    await setupCatalog();
    const joao = await setupAffiliate();
    await createUser("mk-aluno");
    await createUser("mk-outro");
    const sale = await buy("mk-aluno", { affiliateCode: "joao" });
    const refunded = await buy("mk-outro", { affiliateCode: "joao" });
    await buy("mk-outro", { affiliateCode: "joao", now: at(0, 1) }); // nunca paga: sem comissão
    await simulatePaymentAction({ paymentId: sale.paymentId as string, action: "PAY", now: at(0, 1) });
    await simulatePaymentAction({ paymentId: refunded.paymentId as string, action: "PAY", now: at(0, 1) });

    const early = await getAffiliateForAdmin(joao.id, at(2));
    expect(early?.commissions.map((row) => row.status).sort()).toEqual(["HOLD", "HOLD"]);
    expect(early?.totals.HOLD).toBe(3940 * 2);
    await expect(registerAffiliatePayout({ affiliateId: joao.id, adminId: "mk-joao", note: "", now: at(2) })).rejects.toThrow(/Não há comissões/);

    await requestOrderRefund({ orderId: refunded.orderId, actor: { userId: "mk-outro", isAdmin: false }, now: at(3) });
    const later = await getAffiliateForAdmin(joao.id, at(9));
    expect(later?.totals).toEqual({ HOLD: 0, AVAILABLE: 3940, PAID_OUT: 0, CANCELED: 3940 });

    const payout = await registerAffiliatePayout({ affiliateId: joao.id, adminId: "mk-joao", note: "Pix 10/10", now: at(9) });
    expect(payout).toMatchObject({ amountCents: 3940, count: 1 });
    await expect(registerAffiliatePayout({ affiliateId: joao.id, adminId: "mk-joao", note: "", now: at(9) })).rejects.toThrow(/Não há comissões/);
    const dashboard = await getAffiliateDashboard("mk-joao", at(9));
    expect(dashboard?.totals).toMatchObject({ AVAILABLE: 0, PAID_OUT: 3940 });
    expect(dashboard?.sales).toBe(2); // o 3º pedido nunca foi pago: não é "venda"

    // A lista do painel (uma consulta para todos) dá as mesmas somas, e afiliado sem vendas fica zerado.
    await createUser("mk-maria");
    await createAffiliate({ email: "mk-maria@exemplo.com", code: "maria", commissionBps: 1000, payoutInfo: "" });
    const list = await listAffiliatesForAdmin(at(9));
    expect(list.find((item) => item.code === "joao")?.totals).toEqual(dashboard?.totals);
    expect(list.find((item) => item.code === "maria")?.totals).toEqual({ HOLD: 0, AVAILABLE: 0, PAID_OUT: 0, CANCELED: 0 });
  });

  it("assinatura indicada: comissão em cada ciclo pago", async () => {
    await setupCatalog();
    const joao = await setupAffiliate();
    await createUser("mk-aluno");
    const { subscriptionId, paymentId } = await startSubscription({
      buyer: buyer("mk-aluno"),
      planSlug: "mensal",
      method: "PIX",
      billing: { cpf: CPF, phone: null },
      affiliateCode: "joao",
      now: T0,
    });
    await simulatePaymentAction({ paymentId: paymentId as string, action: "PAY", now: at(0, 1) });
    await simulateNextCycle({ subscriptionId, now: at(25) });
    const next = await prisma.payment.findFirstOrThrow({ where: { subscriptionId, status: "PENDING" } });
    await simulatePaymentAction({ paymentId: next.id, action: "PAY", now: at(30) });
    const report = await getAffiliateForAdmin(joao.id, at(40));
    expect(report?.commissions.map((row) => row.amountCents)).toEqual([998, 998]);
    expect(report?.totals.AVAILABLE).toBe(1996);
  });

  it("registrar pagamento com dois cliques ao mesmo tempo: um pagamento só", async () => {
    await setupCatalog();
    const joao = await setupAffiliate();
    await createUser("mk-aluno");
    const sale = await buy("mk-aluno", { affiliateCode: "joao" });
    await simulatePaymentAction({ paymentId: sale.paymentId as string, action: "PAY", now: at(0, 1) });
    const results = await Promise.allSettled([1, 2, 3].map(() => registerAffiliatePayout({ affiliateId: joao.id, adminId: "mk-joao", note: "", now: at(9) })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.affiliatePayout.count()).toBe(1);
  });

  it("painel: e-mail sem conta, pessoa já afiliada e código repetido", async () => {
    await setupAffiliate();
    await expect(createAffiliate({ email: "ninguem@exemplo.com", code: "x-1", commissionBps: 1000, payoutInfo: "" })).rejects.toThrow(/Nenhuma conta/);
    await expect(createAffiliate({ email: "mk-joao@exemplo.com", code: "outro", commissionBps: 1000, payoutInfo: "" })).rejects.toThrow(/já é afiliada/);
    await createUser("mk-maria");
    await expect(createAffiliate({ email: "mk-maria@exemplo.com", code: "joao", commissionBps: 1000, payoutInfo: "" })).rejects.toThrow(/código já é/);
  });
});
