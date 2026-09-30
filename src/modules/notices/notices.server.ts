/**
 * notices.server.ts — As páginas de edital para o público: lista de concursos e a página de um.
 *
 * Quem chama: /concursos, /concursos/[slug], o sitemap e a página inicial.
 * Só páginas PUBLICADAS — exceto com `canSeeDrafts` (prévia do professor/admin).
 */
import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { previewCoupon } from "@/modules/coupons/coupons.server";
import type { CouponTarget } from "@/modules/coupons/rules";
import { getBoardIncidence } from "@/modules/questions/incidence.server";

import { NOTICE_STATUS_ORDER } from "./labels";

const noticeCardSelect = {
  id: true,
  slug: true,
  title: true,
  organization: true,
  role: true,
  status: true,
  registrationEndsOn: true,
  examDate: true,
  summary: true,
  board: { select: { name: true, slug: true } },
} as const satisfies Prisma.ExamNoticeSelect;

export type NoticeCard = Prisma.ExamNoticeGetPayload<{ select: typeof noticeCardSelect }>;

/** Os concursos publicados: primeiro os com inscrições abertas, depois previstos; por data da prova. */
export async function listPublishedNotices(): Promise<NoticeCard[]> {
  const notices = await prisma.examNotice.findMany({
    where: { isPublished: true },
    orderBy: [{ examDate: { sort: "asc", nulls: "last" } }, { title: "asc" }],
    select: noticeCardSelect,
  });
  // A situação ordena "à mão" (a ordem do enum no banco não é a de importância).
  return notices.sort((a, b) => NOTICE_STATUS_ORDER[a.status] - NOTICE_STATUS_ORDER[b.status]);
}

/** O cupom da página vale para esta oferta HOJE (ativo, no prazo, com usos, para este produto/plano)? */
async function noticeCouponFor(code: string | null, target: CouponTarget) {
  if (!code) return null;
  // Sem aluno (página pública): confere tudo menos o limite POR aluno — o checkout confere esse.
  const preview = await previewCoupon({ code, target, userId: null });
  return preview.ok ? preview : null;
}

/**
 * Uma página de edital com o que ela mostra: banca, assuntos, ofertas (produto/plano ATIVOS, cada uma
 * com o cupom da página só se ele VALER para ela) e o "o que mais cai" da banca (Fase 5). Rascunho só
 * com `canSeeDrafts`.
 * `cache`: a página e os metadados (título do Google) pedem a mesma coisa; com o `cache` do React, o
 * banco é consultado uma vez por acesso (parecido com o `functools.lru_cache`, mas só dentro do pedido).
 */
export const getNoticeForViewer = cache(async (slug: string, canSeeDrafts: boolean) => {
  const notice = await prisma.examNotice.findUnique({
    where: { slug },
    include: {
      board: { select: { id: true, name: true, slug: true } },
      subjects: { select: { subject: { select: { id: true, name: true, slug: true, position: true } } } },
      product: { select: { id: true, slug: true, title: true, priceCents: true, accessDays: true, maxInstallments: true, isActive: true } },
      plan: { select: { id: true, slug: true, title: true, priceCents: true, cycle: true, isActive: true } },
    },
  });
  if (!notice || (!notice.isPublished && !canSeeDrafts)) return null;

  // Oferta desativada não aparece (o link daria "não está à venda").
  const product = notice.product?.isActive ? notice.product : null;
  const plan = notice.plan?.isActive ? notice.plan : null;
  const [incidence, productCoupon, planCoupon] = await Promise.all([
    // Só a banca desta página (não o mapa inteiro).
    notice.board ? getBoardIncidence(notice.board.id) : null,
    product ? noticeCouponFor(notice.couponCode, { kind: "PRODUCT", id: product.id, priceCents: product.priceCents }) : null,
    plan ? noticeCouponFor(notice.couponCode, { kind: "PLAN", id: plan.id, priceCents: plan.priceCents }) : null,
  ]);
  return {
    ...notice,
    subjects: notice.subjects.map((item) => item.subject).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    // `coupon`: o cupom da página com o preço final, ou null se ele não vale para esta oferta (vencido,
    // desativado, esgotado, de outro produto...) — a página então não promete o desconto.
    product: product ? { ...product, coupon: productCoupon } : null,
    plan: plan ? { ...plan, coupon: planCoupon } : null,
    topSubjects: incidence ? incidence.subjects.slice(0, 5) : [],
    incidenceTotal: incidence?.total ?? 0,
  };
});

/** Para o sitemap: slug e data da última edição dos publicados. */
export async function listNoticesForSitemap() {
  return prisma.examNotice.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } });
}
