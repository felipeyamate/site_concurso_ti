/**
 * privacy.test.ts — Testes de integração da Fase 7 (LGPD): registro do aceite dos termos, exclusão
 * de conta (o que impede, o que apaga, o que guarda) e "Baixar meus dados" — com PostgreSQL de verdade
 * e o provedor de pagamento SIMULADO.
 *
 * Rodar: npm run test:integration   (exige TEST_DATABASE_URL — ver README)
 */
import { hashPassword } from "better-auth/crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { withAdvisoryLock } from "@/lib/db-locks";
import { auth } from "@/modules/auth/auth";
import { createCourse, createLesson, createModule } from "@/modules/catalog/admin/catalog-admin.server";
import { LEGAL_VERSION } from "@/modules/legal/version";
import { createOrder, startSubscription } from "@/modules/payments/checkout.server";
import { cancelSubscription } from "@/modules/payments/refunds.server";
import { simulatePaymentAction } from "@/modules/payments/simulator.server";
import { recordAccessLog } from "@/modules/privacy/access-log.server";
import { adminDeleteAccount, deleteOwnAccount } from "@/modules/privacy/account-deletion.server";
import { recordLegalConsent, recordSignUpConsent } from "@/modules/privacy/consent.server";
import { buildPersonalDataExport } from "@/modules/privacy/data-export.server";
import { anonymizedEmail } from "@/modules/privacy/rules";
import { answerQuestion } from "@/modules/questions/questions.server";
import { seedQuestionBank } from "../../prisma/seed-questions";

const CPF = "529.982.247-25";
const T0 = new Date("2026-10-01T15:00:00.000Z");
const minutesAfter = (minutes: number) => new Date(T0.getTime() + minutes * 60 * 1000);
const PHRASE = "EXCLUIR MINHA CONTA";

async function resetPrivacy() {
  const users = { userId: { startsWith: "pv-" } };
  const paymentsOfUsers = { OR: [{ order: users }, { subscription: users }] };
  await prisma.fiscalInvoice.deleteMany({ where: { payment: paymentsOfUsers } });
  await prisma.payment.deleteMany({ where: paymentsOfUsers });
  await prisma.order.deleteMany({ where: users });
  await prisma.subscription.deleteMany({ where: users });
  await prisma.billingProfile.deleteMany({ where: users });
  await prisma.affiliate.deleteMany({ where: users });
  await prisma.questionAttempt.deleteMany({ where: users });
  await prisma.legalConsent.deleteMany({ where: users });
  await prisma.user.deleteMany({ where: { id: { startsWith: "pv-" } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: "pv-" } } });
  await prisma.plan.deleteMany({ where: { slug: { startsWith: "pv-" } } });
  await prisma.course.deleteMany({ where: { slug: { startsWith: "teste-privacidade" } } });
  await prisma.verification.deleteMany({ where: { identifier: { startsWith: "reset-password:pv-" } } });
}

async function createUser(id: string, role: "STUDENT" | "TEACHER" | "ADMIN" = "STUDENT") {
  return prisma.user.create({ data: { id, name: `Pessoa ${id}`, email: `${id}@exemplo.com`, role } });
}

/** Curso publicado com uma aula e um produto que o libera; plano mensal. */
async function setupCatalog() {
  const course = await createCourse({ title: "teste-privacidade curso" });
  const courseModule = await createModule({ courseId: course.id, title: "Módulo" });
  const lesson = await createLesson({ moduleId: courseModule.id, title: "Aula" });
  await prisma.course.update({ where: { id: course.id }, data: { isPublished: true, includedInSubscription: true } });
  await prisma.product.create({
    data: { slug: "pv-produto", title: "Curso de teste", priceCents: 9700, isActive: true, courses: { create: [{ courseId: course.id }] } },
  });
  await prisma.plan.create({ data: { slug: "pv-mensal", title: "Mensal", priceCents: 4990, cycle: "MONTHLY", isActive: true } });
  return { course, lesson };
}

function buy(userId: string, now: Date = T0) {
  return createOrder({
    buyer: { id: userId, name: `Pessoa ${userId}`, email: `${userId}@exemplo.com` },
    productSlug: "pv-produto",
    method: "PIX",
    installments: 1,
    billing: { cpf: CPF, phone: "11912345678" },
    now,
  });
}

beforeAll(() => {
  vi.spyOn(console, "info").mockImplementation(() => {}); // e-mails simulados
});

beforeEach(async () => {
  await resetPrivacy();
});

afterAll(async () => {
  await resetPrivacy();
});

describe("aceite dos termos (registro de consentimento)", () => {
  it("grava a versão e um registro com IP/navegador; repetir não duplica; versão antiga pede novo aceite", async () => {
    await createUser("pv-aluna");
    await recordLegalConsent({ userId: "pv-aluna", source: "SIGN_UP", ipAddress: "200.1.2.3", userAgent: "Firefox", now: T0 });
    await recordLegalConsent({ userId: "pv-aluna", source: "REVIEW", ipAddress: "200.1.2.3", userAgent: "Firefox", now: minutesAfter(1) });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: "pv-aluna" } })).toMatchObject({ legalVersion: LEGAL_VERSION });
    const consents = await prisma.legalConsent.findMany({ where: { userId: "pv-aluna" } });
    expect(consents).toHaveLength(1);
    expect(consents[0]).toMatchObject({ version: LEGAL_VERSION, source: "SIGN_UP", ipAddress: "200.1.2.3", userAgent: "Firefox" });

    // Os textos mudaram (a pessoa tinha aceitado uma versão antiga): novo aceite vira um novo registro.
    await prisma.user.update({ where: { id: "pv-aluna" }, data: { legalVersion: "2020-01-01" } });
    await recordLegalConsent({ userId: "pv-aluna", source: "REVIEW", ipAddress: null, userAgent: null, now: minutesAfter(2) });
    expect(await prisma.legalConsent.count({ where: { userId: "pv-aluna" } })).toBe(2);
  });

  it("o aceite 'no cadastro' só vale para conta recém-criada, com e-mail e senha, que nunca aceitou nada", async () => {
    const user = await createUser("pv-aluna");
    await prisma.account.create({ data: { id: "pv-conta", accountId: user.id, providerId: "credential", userId: user.id, password: "hash" } });
    const minutesAfterSignUp = (minutes: number) => new Date(user.createdAt.getTime() + minutes * 60 * 1000);
    const meta = { ipAddress: "200.1.2.3", userAgent: "Firefox" };
    // 11 minutos depois do cadastro: não conta como "no cadastro" (a tela de aceite pede de novo).
    expect(await recordSignUpConsent({ userId: user.id, ...meta, now: minutesAfterSignUp(11) })).toBe(false);
    // Conta que já tinha aceitado uma versão antiga: também não (essa passa pela tela de aceite).
    await createUser("pv-antiga");
    await prisma.user.update({ where: { id: "pv-antiga" }, data: { legalVersion: "2020-01-01" } });
    expect(await recordSignUpConsent({ userId: "pv-antiga", ...meta, now: new Date() })).toBe(false);
    // Conta nova que entrou pelo Google (sem a caixa "Li e aceito" do cadastro): também não.
    const google = await createUser("pv-google");
    await prisma.account.create({ data: { id: "pv-conta-google", accountId: "g-1", providerId: "google", userId: google.id } });
    expect(await recordSignUpConsent({ userId: google.id, ...meta, now: new Date(google.createdAt.getTime() + 60 * 1000) })).toBe(false);
    expect(await prisma.legalConsent.count()).toBe(0);
    // Logo depois do cadastro: grava, como "no cadastro".
    expect(await recordSignUpConsent({ userId: user.id, ...meta, now: minutesAfterSignUp(1) })).toBe(true);
    expect(await prisma.legalConsent.findMany({ where: { userId: user.id }, select: { source: true } })).toEqual([{ source: "SIGN_UP" }]);
  });

  it("dois cliques ao mesmo tempo gravam UM aceite", async () => {
    await createUser("pv-aluna");
    await Promise.all(
      [1, 2, 3].map(() => recordLegalConsent({ userId: "pv-aluna", source: "REVIEW", ipAddress: null, userAgent: null, now: T0 })),
    );
    expect(await prisma.legalConsent.count({ where: { userId: "pv-aluna" } })).toBe(1);
  });
});

describe("exclusão de conta", () => {
  it("confere a frase e o login recente antes de qualquer coisa", async () => {
    await createUser("pv-aluna");
    await expect(deleteOwnAccount({ userId: "pv-aluna", confirmation: "excluir", sessionCreatedAt: T0, now: minutesAfter(1) })).rejects.toThrow(
      /digite exatamente/,
    );
    await expect(deleteOwnAccount({ userId: "pv-aluna", confirmation: PHRASE, sessionCreatedAt: T0, now: minutesAfter(20) })).rejects.toThrow(
      /entre de novo/,
    );
    expect(await prisma.user.findUniqueOrThrow({ where: { id: "pv-aluna" } })).toMatchObject({ deletedAt: null });
  });

  it("assinatura ativa, pagamento aguardando e perfil de professor impedem a exclusão", async () => {
    await setupCatalog();
    await createUser("pv-assinante");
    await createUser("pv-pix");
    await createUser("pv-prof", "TEACHER");
    const { subscriptionId } = await startSubscription({
      buyer: { id: "pv-assinante", name: "Assinante", email: "pv-assinante@exemplo.com" },
      planSlug: "pv-mensal",
      method: "PIX",
      billing: { cpf: CPF, phone: null },
      now: T0,
    });
    await buy("pv-pix");
    const args = { confirmation: PHRASE, sessionCreatedAt: T0, now: minutesAfter(1) };
    await expect(deleteOwnAccount({ userId: "pv-assinante", ...args })).rejects.toThrow(/assinatura ativa/);
    await expect(deleteOwnAccount({ userId: "pv-pix", ...args })).rejects.toThrow(/pagamento aguardando/);
    await expect(deleteOwnAccount({ userId: "pv-prof", ...args })).rejects.toThrow(/professor ou administrador/);

    // Cancelou a assinatura (e a 1ª cobrança, ainda não paga, é cancelada junto): agora pode.
    await cancelSubscription({ subscriptionId, actor: { userId: "pv-assinante", isAdmin: false }, refund: false, now: minutesAfter(2) });
    await deleteOwnAccount({ userId: "pv-assinante", ...args, now: minutesAfter(3) });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: "pv-assinante" } })).toMatchObject({ name: "Conta excluída" });
  });

  it("apaga logins e estudo, anonimiza nome/e-mail, libera o e-mail e GUARDA compras, CPF, aceites e registro de acesso", async () => {
    const { lesson } = await setupCatalog();
    await seedQuestionBank(prisma);
    await createUser("pv-aluna");
    await recordLegalConsent({ userId: "pv-aluna", source: "SIGN_UP", ipAddress: null, userAgent: null, now: T0 });
    const paid = await buy("pv-aluna");
    await simulatePaymentAction({ paymentId: paid.paymentId as string, action: "PAY", now: minutesAfter(1) });
    await prisma.session.create({ data: { id: "pv-sessao", token: "pv-token", userId: "pv-aluna", expiresAt: minutesAfter(60 * 24) } });
    await recordAccessLog({ userId: "pv-aluna", ipAddress: "200.1.2.3", userAgent: "Firefox", at: T0 });
    await prisma.account.create({ data: { id: "pv-conta", accountId: "pv-aluna", providerId: "credential", userId: "pv-aluna", password: "hash" } });
    await prisma.lessonProgress.create({ data: { userId: "pv-aluna", lessonId: lesson.id, positionSeconds: 30, lastWatchedAt: T0 } });
    const question = await prisma.question.findFirstOrThrow({ select: { id: true } });
    await prisma.questionAttempt.create({ data: { userId: "pv-aluna", questionId: question.id, answer: "A", isCorrect: true, source: "PRACTICE", answeredAt: T0 } });
    await prisma.affiliate.create({ data: { userId: "pv-aluna", code: "pv-aluna", commissionBps: 1000, payoutInfo: "Pix: 11912345678" } });

    await deleteOwnAccount({ userId: "pv-aluna", confirmation: " excluir minha conta ", sessionCreatedAt: minutesAfter(5), now: minutesAfter(10) });

    expect(await prisma.user.findUniqueOrThrow({ where: { id: "pv-aluna" } })).toMatchObject({
      name: "Conta excluída",
      email: "conta-excluida-pv-aluna@excluida.invalid",
      legalVersion: null,
      deletedAt: minutesAfter(10),
    });
    // Apagados: logins, formas de entrar, progresso e respostas.
    expect(await prisma.session.count({ where: { userId: "pv-aluna" } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: "pv-aluna" } })).toBe(0);
    expect(await prisma.lessonProgress.count({ where: { userId: "pv-aluna" } })).toBe(0);
    expect(await prisma.questionAttempt.count({ where: { userId: "pv-aluna" } })).toBe(0);
    // Guardados: pedido pago, CPF (sem o celular), aceites, registro de acesso (Marco Civil, 6 meses);
    // afiliado desativado e sem a chave Pix.
    expect(await prisma.order.findUniqueOrThrow({ where: { id: paid.orderId } })).toMatchObject({ status: "PAID", userId: "pv-aluna" });
    expect(await prisma.billingProfile.findUniqueOrThrow({ where: { userId: "pv-aluna" } })).toMatchObject({ cpf: "52998224725", phone: null });
    expect(await prisma.legalConsent.count({ where: { userId: "pv-aluna" } })).toBe(1);
    expect(await prisma.accessLog.count({ where: { userId: "pv-aluna" } })).toBe(1);
    expect(await prisma.affiliate.findUniqueOrThrow({ where: { userId: "pv-aluna" } })).toMatchObject({ isActive: false, payoutInfo: "" });
    // O e-mail verdadeiro está livre para um novo cadastro.
    await createUser("pv-nova");
    await prisma.user.update({ where: { id: "pv-nova" }, data: { email: "pv-aluna@exemplo.com" } });

    // Excluir de novo: recusado.
    await expect(deleteOwnAccount({ userId: "pv-aluna", confirmation: PHRASE, sessionCreatedAt: minutesAfter(10), now: minutesAfter(11) })).rejects.toThrow(
      /já foi excluída/,
    );
  });

  it("cobrança vencida há pouco (ainda pode ser paga) e reembolso em andamento também impedem", async () => {
    await setupCatalog();
    await createUser("pv-aluna");
    const order = await buy("pv-aluna");
    // O Pix venceu ontem: o site ainda mostra "Pagar". Não dá para excluir.
    await prisma.payment.update({ where: { id: order.paymentId as string }, data: { status: "OVERDUE", dueDate: minutesAfter(-24 * 60) } });
    await expect(deleteOwnAccount({ userId: "pv-aluna", confirmation: PHRASE, sessionCreatedAt: T0, now: minutesAfter(1) })).rejects.toThrow(/cobrança vencida/);
    // Reembolso pedido e ainda não concluído: também não.
    await prisma.payment.update({ where: { id: order.paymentId as string }, data: { status: "REFUND_REQUESTED" } });
    await expect(deleteOwnAccount({ userId: "pv-aluna", confirmation: PHRASE, sessionCreatedAt: T0, now: minutesAfter(1) })).rejects.toThrow(/reembolso em andamento/);
    // Vencida há mais de 30 dias: pode excluir.
    await prisma.payment.update({ where: { id: order.paymentId as string }, data: { status: "OVERDUE", dueDate: minutesAfter(-31 * 24 * 60) } });
    await deleteOwnAccount({ userId: "pv-aluna", confirmation: PHRASE, sessionCreatedAt: T0, now: minutesAfter(1) });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: "pv-aluna" } })).toMatchObject({ name: "Conta excluída" });
  });

  it("um reembolso em andamento NO MESMO INSTANTE é esperado e visto (a exclusão pega a trava do pedido)", async () => {
    await setupCatalog();
    await createUser("pv-aluna");
    const order = await buy("pv-aluna");
    await simulatePaymentAction({ paymentId: order.paymentId as string, action: "PAY", now: minutesAfter(1) });
    // Um reembolso segura a trava do pedido (como faz durante a chamada ao provedor) e marca o pagamento.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const hasLock = new Promise<void>((resolve) => (locked = resolve));
    const refund = withAdvisoryLock(prisma, `refund:order:${order.orderId}`, async (tx) => {
      await tx.payment.update({ where: { id: order.paymentId as string }, data: { status: "REFUND_REQUESTED" } });
      locked();
      await gate;
    });
    await hasLock;
    const deletion = deleteOwnAccount({ userId: "pv-aluna", confirmation: PHRASE, sessionCreatedAt: minutesAfter(2), now: minutesAfter(3) });
    await new Promise((resolve) => setTimeout(resolve, 300)); // a exclusão chega e fica esperando a trava
    release();
    await refund;
    await expect(deletion).rejects.toThrow(/reembolso em andamento/);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: "pv-aluna" } })).toMatchObject({ deletedAt: null });
  });

  it("conta excluída não volta: código de 'redefinir senha' anterior é apagado e nenhuma senha/login novo é criado", async () => {
    await createUser("pv-aluna");
    await prisma.account.create({
      data: { id: "pv-conta", accountId: "pv-aluna", providerId: "credential", userId: "pv-aluna", password: await hashPassword("senhaAntiga123") },
    });
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.verification.create({ data: { id: "pv-v1", identifier: "reset-password:pv-antes", value: "pv-aluna", expiresAt: inOneHour } });

    await deleteOwnAccount({ userId: "pv-aluna", confirmation: PHRASE, sessionCreatedAt: new Date(), now: new Date() });

    // O link pedido ANTES da exclusão não vale mais.
    await expect(auth.api.resetPassword({ body: { token: "pv-antes", newPassword: "senhaNova123" } })).rejects.toThrow();
    // Um código que escapasse (gravado no mesmo instante): a senha nova não é criada...
    await prisma.verification.create({ data: { id: "pv-v2", identifier: "reset-password:pv-depois", value: "pv-aluna", expiresAt: inOneHour } });
    await auth.api.resetPassword({ body: { token: "pv-depois", newPassword: "senhaNova123" } }).catch(() => undefined);
    expect(await prisma.account.count({ where: { userId: "pv-aluna" } })).toBe(0);
    // ...e ninguém entra na conta excluída.
    await expect(auth.api.signInEmail({ body: { email: anonymizedEmail("pv-aluna"), password: "senhaNova123" } })).rejects.toThrow();
    const context = await auth.$context;
    expect(await context.internalAdapter.createSession("pv-aluna")).toBeFalsy();
    expect(await prisma.session.count({ where: { userId: "pv-aluna" } })).toBe(0);
  });

  it("resposta que chega depois da exclusão é recusada (nada é gravado na conta excluída)", async () => {
    await seedQuestionBank(prisma);
    await createUser("pv-aluna");
    await deleteOwnAccount({ userId: "pv-aluna", confirmation: PHRASE, sessionCreatedAt: T0, now: minutesAfter(1) });
    const question = await prisma.question.findFirstOrThrow({ where: { isPublished: true }, select: { id: true } });
    await expect(answerQuestion({ viewer: { id: "pv-aluna", role: "STUDENT" }, questionId: question.id, answer: "A" })).rejects.toThrow(/conta foi excluída/);
    expect(await prisma.questionAttempt.count({ where: { userId: "pv-aluna" } })).toBe(0);
  });

  it("sem nenhuma compra, os dados de cobrança também saem", async () => {
    await createUser("pv-aluna");
    await prisma.billingProfile.create({ data: { userId: "pv-aluna", cpf: "52998224725", phone: "11912345678" } });
    await deleteOwnAccount({ userId: "pv-aluna", confirmation: PHRASE, sessionCreatedAt: T0, now: minutesAfter(1) });
    expect(await prisma.billingProfile.count({ where: { userId: "pv-aluna" } })).toBe(0);
  });

  it("pelo painel: o admin digita o e-mail da conta; não exclui a própria conta", async () => {
    await createUser("pv-admin", "ADMIN");
    await createUser("pv-aluna");
    await expect(adminDeleteAccount({ actorId: "pv-admin", userId: "pv-aluna", typedEmail: "outra@exemplo.com" })).rejects.toThrow(/não é o desta conta/);
    await expect(adminDeleteAccount({ actorId: "pv-admin", userId: "pv-admin", typedEmail: "pv-admin@exemplo.com" })).rejects.toThrow(/sua própria conta/);
    await adminDeleteAccount({ actorId: "pv-admin", userId: "pv-aluna", typedEmail: " PV-ALUNA@exemplo.com ", now: T0 });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: "pv-aluna" } })).toMatchObject({ name: "Conta excluída", deletedAt: T0 });
  });
});

describe("baixar meus dados", () => {
  it("traz conta, aceites, compras, pagamentos e estudo — sem senha nem tokens", async () => {
    const { lesson } = await setupCatalog();
    await createUser("pv-aluna");
    await recordLegalConsent({ userId: "pv-aluna", source: "SIGN_UP", ipAddress: "200.1.2.3", userAgent: "Firefox", now: T0 });
    await prisma.account.create({ data: { id: "pv-conta", accountId: "pv-aluna", providerId: "credential", userId: "pv-aluna", password: "hash-secreto" } });
    await prisma.session.create({ data: { id: "pv-sessao", token: "token-secreto", userId: "pv-aluna", expiresAt: minutesAfter(60) } });
    await recordAccessLog({ userId: "pv-aluna", ipAddress: "200.1.2.3", userAgent: "Firefox", at: T0 });
    await prisma.lessonProgress.create({ data: { userId: "pv-aluna", lessonId: lesson.id, positionSeconds: 30, lastWatchedAt: T0 } });
    await buy("pv-aluna");

    const data = await buildPersonalDataExport("pv-aluna", T0);
    expect(data?.conta).toMatchObject({ id: "pv-aluna", email: "pv-aluna@exemplo.com", versaoDosTermosAceita: LEGAL_VERSION });
    expect(data?.aceitesDosTermosEPrivacidade).toEqual([
      expect.objectContaining({ versao: LEGAL_VERSION, onde: "cadastro", ip: "200.1.2.3", navegador: "Firefox" }),
    ]);
    expect(data?.formasDeEntrar).toEqual([expect.objectContaining({ tipo: "e-mail e senha" })]);
    expect(data?.registrosDeAcesso).toEqual([{ em: T0, ip: "200.1.2.3", navegador: "Firefox" }]);
    expect(data?.pedidos).toEqual([expect.objectContaining({ produto: "Curso de teste", valorEmCentavos: 9700, situacao: "PENDING" })]);
    expect(data?.pagamentos).toHaveLength(1);
    expect(data?.progressoNasAulas).toEqual([expect.objectContaining({ aula: "Aula", posicaoEmSegundos: 30 })]);
    expect(data?.dadosDeCobranca).toMatchObject({ cpf: "52998224725", celular: "11912345678" });
    const text = JSON.stringify(data);
    expect(text).not.toContain("hash-secreto");
    expect(text).not.toContain("token-secreto");
    expect(await buildPersonalDataExport("pv-nao-existe")).toBeNull();
  });
});
