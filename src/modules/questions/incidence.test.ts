/**
 * incidence.test.ts — O mapa "o que mais cai" por banca.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { buildIncidenceMap } from "./incidence";

const boards = [
  { id: "b1", name: "Cesgranrio", slug: "cesgranrio" },
  { id: "b2", name: "FGV", slug: "fgv" },
];
const subjects = [
  { id: "s1", name: "Segurança", slug: "seguranca" },
  { id: "s2", name: "Redes", slug: "redes" },
  { id: "s3", name: "Office", slug: "office" },
];

describe("buildIncidenceMap", () => {
  it("por banca: assuntos do mais cobrado ao menos, com a porcentagem da banca", () => {
    const map = buildIncidenceMap({
      counts: [
        { boardId: "b1", subjectId: "s1", count: 6 },
        { boardId: "b1", subjectId: "s2", count: 2 },
        { boardId: "b2", subjectId: "s3", count: 1 },
        { boardId: "b2", subjectId: "s1", count: 1 },
      ],
      boards,
      subjects,
    });
    expect(map.boards.map((board) => [board.name, board.total])).toEqual([
      ["Cesgranrio", 8],
      ["FGV", 2],
    ]);
    expect(map.boards[0].subjects.map((item) => [item.name, item.count, item.percent])).toEqual([
      ["Segurança", 6, 75],
      ["Redes", 2, 25],
    ]);
    // Empate: ordem alfabética.
    expect(map.boards[1].subjects.map((item) => item.name)).toEqual(["Office", "Segurança"]);
  });

  it("todas as bancas juntas somam os assuntos (porcentagem com uma casa decimal)", () => {
    const map = buildIncidenceMap({
      counts: [
        { boardId: "b1", subjectId: "s1", count: 1 },
        { boardId: "b2", subjectId: "s1", count: 1 },
        { boardId: "b2", subjectId: "s2", count: 1 },
      ],
      boards,
      subjects,
    });
    expect(map.overall.total).toBe(3);
    expect(map.overall.subjects.map((item) => [item.name, item.count, item.percent])).toEqual([
      ["Segurança", 2, 66.7],
      ["Redes", 1, 33.3],
    ]);
  });

  it("sem questões de prova: mapa vazio", () => {
    const map = buildIncidenceMap({ counts: [], boards, subjects });
    expect(map.boards).toEqual([]);
    expect(map.overall).toMatchObject({ total: 0, subjects: [] });
  });
});
