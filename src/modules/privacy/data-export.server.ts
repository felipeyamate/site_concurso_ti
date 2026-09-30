/**
 * data-export.server.ts — "Baixar meus dados": tudo o que o site guarda sobre a pessoa, num arquivo.
 *
 * Quem chama: a rota /area-do-aluno/conta/meus-dados (download de um .json). Os testes chamam direto.
 * O que devolve: um objeto com nomes em português, pronto para virar JSON.
 *
 * Por que existe: a LGPD (art. 18, II e V) garante o acesso e a portabilidade dos dados. JSON é um
 * formato aberto: abre em qualquer editor de texto e é lido por qualquer linguagem (inclusive
 * `json.load` no Python).
 *
 * O que NÃO entra: segredos (senha — que nem guardamos em texto —, tokens de login) e dados de
 * outras pessoas. Valores em dinheiro vão em centavos (como no banco), com o nome do campo dizendo isso.
 */
import "server-only";

import { prisma } from "@/lib/db";

/** Versão do formato do arquivo (se um dia mudarmos os campos, quem ler sabe qual é). */
export const DATA_EXPORT_FORMAT_VERSION = 1;

export async function buildPersonalDataExport(userId: string, now: Date = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, emailVerified: true, role: true, createdAt: true, legalVersion: true },
  });
  if (!user) return null;

  // Tudo em paralelo (como um `asyncio.gather`): cada consulta busca só os campos que vão para o arquivo.
  const [consents, sessions, accessLogs, accounts, billing, enrollments, progress, attempts, mockExams, orders, subscriptions, payments, affiliate] =
    await Promise.all([
      prisma.legalConsent.findMany({ where: { userId }, orderBy: { acceptedAt: "asc" } }),
      prisma.session.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true } }),
      prisma.accessLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { createdAt: true, ipAddress: true, userAgent: true } }),
      prisma.account.findMany({ where: { userId }, select: { providerId: true, createdAt: true } }),
      prisma.billingProfile.findUnique({ where: { userId }, select: { cpf: true, phone: true, createdAt: true } }),
      prisma.enrollment.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, include: { course: { select: { title: true } } } }),
      prisma.lessonProgress.findMany({
        where: { userId },
        orderBy: { lastWatchedAt: "asc" },
        include: { lesson: { select: { title: true, course: { select: { title: true } } } } },
      }),
      prisma.questionAttempt.findMany({ where: { userId }, orderBy: { answeredAt: "asc" } }),
      prisma.mockExam.findMany({ where: { userId }, orderBy: { startedAt: "asc" } }),
      prisma.order.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.subscription.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.payment.findMany({ where: { OR: [{ order: { userId } }, { subscription: { userId } }] }, orderBy: { createdAt: "asc" } }),
      prisma.affiliate.findUnique({ where: { userId }, select: { code: true, commissionBps: true, payoutInfo: true, isActive: true, createdAt: true } }),
    ]);

  return {
    formato: { versao: DATA_EXPORT_FORMAT_VERSION, geradoEm: now.toISOString() },
    conta: {
      id: user.id,
      nome: user.name,
      email: user.email,
      emailConfirmado: user.emailVerified,
      perfil: user.role,
      criadaEm: user.createdAt,
      versaoDosTermosAceita: user.legalVersion,
    },
    aceitesDosTermosEPrivacidade: consents.map((item) => ({
      versao: item.version,
      onde: item.source === "SIGN_UP" ? "cadastro" : "tela de aceite",
      aceitoEm: item.acceptedAt,
      ip: item.ipAddress,
      navegador: item.userAgent,
    })),
    dispositivosConectados: sessions.map((item) => ({ entrouEm: item.createdAt, venceEm: item.expiresAt, ip: item.ipAddress, navegador: item.userAgent })),
    // Registro de acesso do Marco Civil (cada login dos últimos 6 meses).
    registrosDeAcesso: accessLogs.map((item) => ({ em: item.createdAt, ip: item.ipAddress, navegador: item.userAgent })),
    formasDeEntrar: accounts.map((item) => ({ tipo: item.providerId === "credential" ? "e-mail e senha" : item.providerId, desde: item.createdAt })),
    dadosDeCobranca: billing ? { cpf: billing.cpf, celular: billing.phone, cadastradoEm: billing.createdAt } : null,
    matriculas: enrollments.map((item) => ({
      curso: item.course.title,
      origem: item.source,
      inicio: item.startsAt,
      fim: item.expiresAt,
      revogadaEm: item.revokedAt,
    })),
    progressoNasAulas: progress.map((item) => ({
      curso: item.lesson.course.title,
      aula: item.lesson.title,
      posicaoEmSegundos: item.positionSeconds,
      concluidaEm: item.completedAt,
      ultimaVezEm: item.lastWatchedAt,
    })),
    respostasDeQuestoes: attempts.map((item) => ({
      questao: item.questionId,
      resposta: item.answer,
      acertou: item.isCorrect,
      onde: item.source,
      simulado: item.mockExamId,
      respondidaEm: item.answeredAt,
    })),
    simulados: mockExams.map((item) => ({
      id: item.id,
      titulo: item.title,
      questoes: item.questionCount,
      tempoEmMinutos: item.timeLimitMinutes,
      inicio: item.startedAt,
      fim: item.finishedAt,
      acertos: item.correctCount,
    })),
    pedidos: orders.map((item) => ({
      id: item.id,
      produto: item.productTitle,
      valorEmCentavos: item.priceCents,
      descontoEmCentavos: item.discountCents,
      cupom: item.couponCode,
      formaDePagamento: item.method,
      parcelas: item.installments,
      situacao: item.status,
      pagoEm: item.paidAt,
      reembolsoPedidoEm: item.refundRequestedAt,
      criadoEm: item.createdAt,
    })),
    assinaturas: subscriptions.map((item) => ({
      id: item.id,
      plano: item.planTitle,
      valorEmCentavos: item.priceCents,
      descontoEmCentavos: item.discountCents,
      cupom: item.couponCode,
      ciclo: item.cycle,
      situacao: item.status,
      canceladaEm: item.canceledAt,
      criadaEm: item.createdAt,
    })),
    pagamentos: payments.map((item) => ({
      pedido: item.orderId,
      assinatura: item.subscriptionId,
      formaDePagamento: item.method,
      valorEmCentavos: item.valueCents,
      vencimento: item.dueDate,
      situacao: item.status,
      pagoEm: item.paidAt,
    })),
    afiliado: affiliate
      ? {
          codigo: affiliate.code,
          comissaoEmPontosBase: affiliate.commissionBps,
          comoReceber: affiliate.payoutInfo,
          ativo: affiliate.isActive,
          desde: affiliate.createdAt,
        }
      : null,
  };
}
