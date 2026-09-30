/**
 * incidence.server.ts — Busca os números do mapa "o que mais cai".
 *
 * Quem chama: a página pública /o-que-mais-cai (mapa inteiro) e as páginas de concurso (só a banca
 * delas, `getBoardIncidence`).
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

/**
 * O "o que mais cai" de UMA banca (páginas de concurso): conta só as questões dessa banca, em vez de
 * montar o mapa inteiro para usar um pedaço — a página de concurso é a que recebe anúncios e
 * afiliados, e o trabalho aqui não cresce com o banco de questões inteiro.
 * Mesma regra (`buildIncidenceMap`), com os números de uma banca só. Devolve null se ela não tem questões de prova.
 */
export async function getBoardIncidence(boardId: string) {
  const counts = await prisma.question.groupBy({
    by: ["subjectId"],
    where: { isPublished: true, examId: { not: null }, boardId },
    _count: { _all: true },
  });
  if (counts.length === 0) return null;
  const [board, subjects] = await Promise.all([
    prisma.board.findUnique({ where: { id: boardId }, select: { id: true, name: true, slug: true } }),
    prisma.subject.findMany({ where: { id: { in: counts.map((row) => row.subjectId) } }, select: { id: true, name: true, slug: true } }),
  ]);
  const map = buildIncidenceMap({
    counts: counts.map((row) => ({ boardId, subjectId: row.subjectId, count: row._count._all })),
    boards: board ? [board] : [],
    subjects,
  });
  return map.boards[0] ?? null;
}
