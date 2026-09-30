/**
 * performance.server.ts — Busca os números do "Meu desempenho" no banco.
 *
 * Quem chama: a página /area-do-aluno/desempenho.
 * As contas (porcentagem, pontos fracos) ficam em `performance.ts` (regras puras e testadas).
 */
import "server-only";

import { prisma } from "@/lib/db";

import { overallTotals, summarizeBySubject, type SubjectTotals } from "./performance";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Desempenho do aluno.
 * Passos:
 *  1. Soma as respostas por assunto (uma consulta SQL que junta respostas → questões → assuntos;
 *     paralelo em Python: um `GROUP BY` como no pandas `groupby(...).agg(...)`).
 *  2. Conta as respostas dos últimos 7 dias e lista os últimos simulados finalizados.
 *  3. Monta a tabela com as regras de `performance.ts`.
 */
export async function getMyPerformance(userId: string, now: Date = new Date()) {
  // `$queryRaw` com crase (template): os valores viram parâmetros ($1...), nunca texto colado —
  // não há como injetar SQL. `::int` porque o Postgres devolve COUNT como número grande (bigint).
  const rows = await prisma.$queryRaw<SubjectTotals[]>`
    SELECT s.id AS "subjectId", s.name AS "name", s.slug AS "slug",
           COUNT(*)::int AS "attempts",
           COUNT(*) FILTER (WHERE a.is_correct)::int AS "correct"
    FROM question_attempts a
    JOIN questions q ON q.id = a.question_id
    JOIN subjects s ON s.id = q.subject_id
    WHERE a.user_id = ${userId}
    GROUP BY s.id, s.name, s.slug
  `;
  const [lastWeek, mockExams] = await Promise.all([
    prisma.questionAttempt.count({ where: { userId, answeredAt: { gte: new Date(now.getTime() - 7 * DAY_IN_MS) } } }),
    prisma.mockExam.findMany({
      where: { userId, finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      take: 10,
      select: { id: true, title: true, finishedAt: true, correctCount: true, questionCount: true },
    }),
  ]);
  return { totals: overallTotals(rows), subjects: summarizeBySubject(rows), lastWeek, mockExams };
}
