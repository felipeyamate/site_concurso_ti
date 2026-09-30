/**
 * incidence.ts — O mapa "o que mais cai": quais assuntos aparecem mais nas provas de cada banca.
 *
 * Quem chama: `incidence.server.ts` (que conta as questões no banco) e a página pública
 * /o-que-mais-cai.
 *
 * De onde vêm os números: das questões PUBLICADAS que são DE PROVA (ligadas a um concurso
 * cadastrado). Questões inéditas (autorais) não contam — o mapa mostra o que as bancas cobraram
 * de verdade. Quanto mais provas cadastradas, mais fiel o mapa (a página mostra o total analisado).
 *
 * Arquivo "puro", testado em `incidence.test.ts`.
 */

export type IncidenceCount = { boardId: string; subjectId: string; count: number };
export type Named = { id: string; name: string; slug: string };

export type IncidenceSubject = { subjectId: string; name: string; slug: string; count: number; percent: number };
export type IncidenceBoard = {
  boardId: string | null; // null = todas as bancas juntas
  name: string;
  slug: string | null;
  total: number;
  subjects: IncidenceSubject[];
};

/** Porcentagem com uma casa decimal (ex.: 12,5%), para diferenciar assuntos parecidos. */
function percentOf(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function rankSubjects(counts: Map<string, number>, subjects: Map<string, Named>, total: number): IncidenceSubject[] {
  return [...counts.entries()]
    .map(([subjectId, count]) => {
      const subject = subjects.get(subjectId);
      return {
        subjectId,
        name: subject?.name ?? "Assunto removido",
        slug: subject?.slug ?? "",
        count,
        percent: percentOf(count, total),
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * Monta o mapa.
 * Passos:
 *  1. Para cada banca, soma as questões por assunto e ordena do mais cobrado ao menos cobrado.
 *  2. Faz o mesmo com todas as bancas juntas (a primeira "aba" da página).
 *  3. Bancas ordenadas pelo total de questões analisadas (a com mais dados primeiro).
 * Paralelo em Python: um `df.groupby(["banca", "assunto"]).size()` seguido de `sort_values`.
 */
export function buildIncidenceMap(input: {
  counts: readonly IncidenceCount[];
  boards: readonly Named[];
  subjects: readonly Named[];
}): { overall: IncidenceBoard; boards: IncidenceBoard[] } {
  const subjects = new Map(input.subjects.map((subject) => [subject.id, subject]));
  const boardsById = new Map(input.boards.map((board) => [board.id, board]));

  const perBoard = new Map<string, Map<string, number>>();
  const overallCounts = new Map<string, number>();
  for (const row of input.counts) {
    if (row.count <= 0) continue;
    const boardCounts = perBoard.get(row.boardId) ?? new Map<string, number>();
    boardCounts.set(row.subjectId, (boardCounts.get(row.subjectId) ?? 0) + row.count);
    perBoard.set(row.boardId, boardCounts);
    overallCounts.set(row.subjectId, (overallCounts.get(row.subjectId) ?? 0) + row.count);
  }

  const boards: IncidenceBoard[] = [...perBoard.entries()]
    .map(([boardId, counts]) => {
      const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
      const board = boardsById.get(boardId);
      return {
        boardId,
        name: board?.name ?? "Banca removida",
        slug: board?.slug ?? null,
        total,
        subjects: rankSubjects(counts, subjects, total),
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));

  const overallTotal = [...overallCounts.values()].reduce((sum, count) => sum + count, 0);
  return {
    overall: {
      boardId: null,
      name: "Todas as bancas",
      slug: null,
      total: overallTotal,
      subjects: rankSubjects(overallCounts, subjects, overallTotal),
    },
    boards,
  };
}
