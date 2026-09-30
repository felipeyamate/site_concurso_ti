/**
 * incidence.server.ts — Busca os números do mapa "o que mais cai".
 *
 * Quem chama: a página pública /o-que-mais-cai.
 * A montagem do mapa fica em `incidence.ts` (regra pura e testada). Aqui só contamos, no banco,
 * as questões publicadas DE PROVA (com prova e banca) por banca e assunto.
 */
import "server-only";

import { prisma } from "@/lib/db";

import { buildIncidenceMap } from "./incidence";

export async function getIncidenceMap() {
  const where = { isPublished: true, examId: { not: null }, boardId: { not: null } };
  const [counts, boards, subjects, examCount] = await Promise.all([
    // Paralelo em Python: `df.groupby(["board_id", "subject_id"]).size()`.
    prisma.question.groupBy({ by: ["boardId", "subjectId"], where, _count: { _all: true } }),
    prisma.board.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.subject.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.exam.count({ where: { questions: { some: { isPublished: true } } } }),
  ]);
  const map = buildIncidenceMap({
    counts: counts.map((row) => ({ boardId: row.boardId as string, subjectId: row.subjectId, count: row._count._all })),
    boards,
    subjects,
  });
  return { ...map, examCount };
}
