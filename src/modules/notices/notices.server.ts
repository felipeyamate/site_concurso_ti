/**
 * notices.server.ts — As páginas de edital para o público: lista de concursos e a página de um.
 *
 * Quem chama: /concursos, /concursos/[slug], o sitemap e a página inicial.
 * Só páginas PUBLICADAS — exceto com `canSeeDrafts` (prévia do professor/admin).
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getIncidenceMap } from "@/modules/questions/incidence.server";

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

/**
 * Uma página de edital com o que ela mostra: banca, assuntos, ofertas (produto/plano ATIVOS) e o
 * "o que mais cai" da banca (Fase 5). Rascunho só com `canSeeDrafts`.
 */
export async function getNoticeForViewer(slug: string, canSeeDrafts: boolean) {
  const notice = await prisma.examNotice.findUnique({
    where: { slug },
    include: {
      board: { select: { id: true, name: true, slug: true } },
      subjects: { select: { subject: { select: { id: true, name: true, slug: true, position: true } } } },
      product: { select: { slug: true, title: true, priceCents: true, accessDays: true, maxInstallments: true, isActive: true } },
      plan: { select: { slug: true, title: true, priceCents: true, cycle: true, isActive: true } },
    },
  });
  if (!notice || (!notice.isPublished && !canSeeDrafts)) return null;

  const incidence = notice.board ? (await getIncidenceMap()).boards.find((board) => board.boardId === notice.board?.id) ?? null : null;
  return {
    ...notice,
    subjects: notice.subjects.map((item) => item.subject).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    // Oferta desativada não aparece (o link daria "não está à venda").
    product: notice.product?.isActive ? notice.product : null,
    plan: notice.plan?.isActive ? notice.plan : null,
    topSubjects: incidence ? incidence.subjects.slice(0, 5) : [],
    incidenceTotal: incidence?.total ?? 0,
  };
}

/** Para o sitemap: slug e data da última edição dos publicados. */
export async function listNoticesForSitemap() {
  return prisma.examNotice.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } });
}
