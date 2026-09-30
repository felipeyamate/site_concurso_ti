/**
 * tracks.server.ts — As trilhas de estudo para o público: lista, página de uma trilha (com o
 * progresso de quem está vendo) e o sitemap.
 *
 * Quem chama: /trilhas, /trilhas/[slug], a página de concurso (trilha indicada), a página inicial e
 * o sitemap (`seo/feeds.server.ts`).
 * Só trilhas PUBLICADAS — exceto com `canSeeDrafts` (prévia do professor/admin).
 * As regras (o que aparece, acesso, feito, próximo passo) ficam em `rules.ts`; aqui só buscamos os
 * dados para elas.
 */
import "server-only";

import { cache } from "react";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { EnrollmentSnapshot } from "@/modules/enrollment/access";
import { listEnrollments } from "@/modules/enrollment/enrollment.server";
import { getBoardIncidence } from "@/modules/questions/incidence.server";

import { buildTrackView, type PracticeStat, type TrackSectionInput, type TrackView } from "./rules";

const named = { select: { id: true, name: true, slug: true } } as const;

const lessonSelect = {
  id: true,
  slug: true,
  title: true,
  durationSeconds: true,
  isPublished: true,
  isFreePreview: true,
  course: { select: { id: true, slug: true, title: true, isPublished: true } },
} as const satisfies Prisma.LessonSelect;

const sectionsInclude = {
  orderBy: { position: "asc" },
  include: {
    subject: named,
    items: { orderBy: { position: "asc" }, include: { lesson: { select: lessonSelect }, subject: named, board: named } },
  },
} as const satisfies Prisma.Track$sectionsArgs;

type SectionRow = Prisma.TrackSectionGetPayload<{ include: (typeof sectionsInclude)["include"] }>;

/** As etapas do banco → o formato das regras (`TrackSectionInput`). */
export function toSectionInputs(sections: SectionRow[]): TrackSectionInput[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    subject: section.subject,
    items: section.items.flatMap((item): TrackSectionInput["items"] => {
      if (item.kind === "LESSON" && item.lesson) return [{ id: item.id, kind: "LESSON", note: item.note, lesson: item.lesson }];
      if (item.kind === "PRACTICE" && item.subject) {
        return [{ id: item.id, kind: "PRACTICE", note: item.note, questionGoal: item.questionGoal, subject: item.subject, board: item.board }];
      }
      return []; // não acontece (as travas CHECK do banco garantem), mas o TypeScript não sabe
    }),
  }));
}

export type TrackCard = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  board: { name: string; slug: string } | null;
  lessonCount: number;
  practiceCount: number;
};

/**
 * As trilhas publicadas (para /trilhas e a página inicial), com quantas aulas e treinos cada uma tem.
 * `limit`: a página inicial mostra só as primeiras (não precisa buscar todas).
 * Passos: 1. as trilhas (só os dados do cartão); 2. as contagens numa consulta só, agrupada no banco
 * (sem carregar as etapas e os passos de todas as trilhas só para contar).
 * Paralelo em Python: `df.groupby("track_id").agg(...)` em vez de um laço sobre as linhas.
 */
export async function listPublishedTracks(limit?: number): Promise<TrackCard[]> {
  const tracks = await prisma.track.findMany({
    where: { isPublished: true },
    orderBy: { title: "asc" },
    take: limit,
    select: { id: true, slug: true, title: true, summary: true, board: { select: { name: true, slug: true } } },
  });
  if (tracks.length === 0) return [];
  // Aulas em rascunho (ou de curso em rascunho) não contam: o aluno não as vê.
  const counts = await prisma.$queryRaw<Array<{ track_id: string; lessons: bigint; practices: bigint }>>`
    SELECT s.track_id,
           COUNT(*) FILTER (WHERE i.kind = 'LESSON' AND l.is_published AND c.is_published) AS lessons,
           COUNT(*) FILTER (WHERE i.kind = 'PRACTICE') AS practices
    FROM track_items i
    JOIN track_sections s ON s.id = i.section_id
    LEFT JOIN lessons l ON l.id = i.lesson_id
    LEFT JOIN courses c ON c.id = l.course_id
    WHERE s.track_id IN (${Prisma.join(tracks.map((track) => track.id))})
    GROUP BY s.track_id`;
  const byTrack = new Map(counts.map((row) => [row.track_id, row]));
  return tracks.map((track) => ({
    ...track,
    lessonCount: Number(byTrack.get(track.id)?.lessons ?? 0),
    practiceCount: Number(byTrack.get(track.id)?.practices ?? 0),
  }));
}

/**
 * Uma trilha (sem nada da pessoa que está vendo): dados, oferta (produto/plano ATIVOS), etapas e o
 * quanto o assunto de cada etapa cai na banca da trilha. Rascunho só com `canSeeDrafts`.
 * `cache`: a página e os metadados (título do Google) pedem a mesma coisa; o banco é consultado uma
 * vez por acesso (parecido com o `functools.lru_cache`, mas só dentro do pedido).
 */
export const getTrackBySlug = cache(async (slug: string, canSeeDrafts: boolean) => {
  const track = await prisma.track.findUnique({
    where: { slug },
    include: {
      board: named,
      product: { select: { id: true, slug: true, title: true, priceCents: true, accessDays: true, maxInstallments: true, isActive: true } },
      plan: { select: { id: true, slug: true, title: true, priceCents: true, cycle: true, isActive: true } },
      sections: sectionsInclude,
    },
  });
  if (!track || (!track.isPublished && !canSeeDrafts)) return null;
  const incidence = track.board ? await getBoardIncidence(track.board.id) : null;
  const percentBySubject = new Map((incidence?.subjects ?? []).map((subject) => [subject.subjectId, subject.percent]));
  return {
    ...track,
    // Oferta desativada não aparece (o link daria "não está à venda").
    product: track.product?.isActive ? track.product : null,
    plan: track.plan?.isActive ? track.plan : null,
    sections: toSectionInputs(track.sections),
    percentBySubject,
  };
});

/**
 * O que a pessoa já fez nos assuntos: questões DIFERENTES respondidas, respostas e acertos, por
 * assunto e banca (na prática e nos simulados). Uma consulta só, agrupada no banco.
 * Paralelo em Python: `df.groupby(["subject_id", "board_id"]).agg(...)`.
 */
export async function listPracticeStats(userId: string, subjectIds: string[]): Promise<PracticeStat[]> {
  if (subjectIds.length === 0) return [];
  const rows = await prisma.$queryRaw<Array<{ subject_id: string; board_id: string | null; answered: bigint; attempts: bigint; correct: bigint }>>`
    SELECT q.subject_id, q.board_id,
           COUNT(DISTINCT a.question_id) AS answered,
           COUNT(*) AS attempts,
           COUNT(*) FILTER (WHERE a.is_correct) AS correct
    FROM question_attempts a
    JOIN questions q ON q.id = a.question_id
    WHERE a.user_id = ${userId} AND q.subject_id IN (${Prisma.join(subjectIds)})
    GROUP BY q.subject_id, q.board_id`;
  // O Postgres devolve contagens como BigInt; aqui elas cabem folgado num `number`.
  return rows.map((row) => ({
    subjectId: row.subject_id,
    boardId: row.board_id,
    answered: Number(row.answered),
    attempts: Number(row.attempts),
    correct: Number(row.correct),
  }));
}

/**
 * A trilha do ponto de vista de quem está vendo (`null` = visitante sem login).
 * Passos: 1. junta os cursos, aulas e assuntos da trilha; 2. com login, busca AO MESMO TEMPO as
 * matrículas nesses cursos, as aulas concluídas e o que a pessoa fez nos assuntos; 3. aplica as regras.
 */
export async function getTrackView(
  sections: TrackSectionInput[],
  viewer: { userId: string; role: unknown } | null,
  now: Date = new Date(),
): Promise<TrackView> {
  const items = sections.flatMap((section) => section.items);
  const courseIds = [...new Set(items.flatMap((item) => (item.kind === "LESSON" ? [item.lesson.course.id] : [])))];
  const lessonIds = items.flatMap((item) => (item.kind === "LESSON" ? [item.lesson.id] : []));
  const subjectIds = [...new Set(items.flatMap((item) => (item.kind === "PRACTICE" ? [item.subject.id] : [])))];

  const enrollmentByCourse = new Map<string, EnrollmentSnapshot | null>();
  let completedLessonIds = new Set<string>();
  let practiceStats: PracticeStat[] = [];
  if (viewer) {
    const [enrollments, completed, stats] = await Promise.all([
      // Uma matrícula por curso, juntando as origens (manual, compra, assinatura) — como no catálogo.
      listEnrollments(viewer.userId, now, courseIds),
      prisma.lessonProgress.findMany({ where: { userId: viewer.userId, lessonId: { in: lessonIds }, completedAt: { not: null } }, select: { lessonId: true } }),
      listPracticeStats(viewer.userId, subjectIds),
    ]);
    for (const { courseId, ...enrollment } of enrollments) enrollmentByCourse.set(courseId, enrollment);
    completedLessonIds = new Set(completed.map((row) => row.lessonId));
    practiceStats = stats;
  }
  return buildTrackView({ sections, role: viewer?.role, enrollmentByCourse, completedLessonIds, practiceStats, now });
}

/** Para o sitemap: slug e data da última edição das publicadas. */
export async function listTracksForSitemap() {
  return prisma.track.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } });
}
