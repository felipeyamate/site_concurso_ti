/**
 * rules.test.ts — Testes das regras das trilhas: visão do aluno (acesso, feito, próximo passo,
 * rascunhos) e o rascunho montado pelo "o que mais cai".
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  buildTrackDraft,
  buildTrackView,
  lessonHref,
  practiceHref,
  practiceProgress,
  type TrackLesson,
  type TrackSectionInput,
} from "./rules";

const NOW = new Date("2026-10-02T15:00:00Z");
const base = { id: "c-base", slug: "curso-base", title: "Curso Base", isPublished: true };
const specific = { id: "c-bb", slug: "bb-especifico", title: "Aulas do BB", isPublished: true };
const security = { id: "s-seg", name: "Segurança", slug: "seguranca" };
const networks = { id: "s-redes", name: "Redes", slug: "redes" };
const cesgranrio = { id: "b-ces", name: "Cesgranrio", slug: "cesgranrio" };

function lesson(id: string, course = base, extra: Partial<TrackLesson> = {}): TrackLesson {
  return { id, slug: id, title: `Aula ${id}`, durationSeconds: 600, isPublished: true, isFreePreview: false, course, ...extra };
}

const sections: TrackSectionInput[] = [
  {
    id: "sec-1",
    title: "Segurança",
    description: "",
    subject: security,
    items: [
      { id: "i-1", kind: "LESSON", note: "", lesson: lesson("backup", base, { isFreePreview: true }) },
      { id: "i-2", kind: "LESSON", note: "Cai muito", lesson: lesson("golpes", specific) },
      { id: "i-3", kind: "PRACTICE", note: "", questionGoal: 5, subject: security, board: cesgranrio },
    ],
  },
  {
    id: "sec-2",
    title: "Redes",
    description: "",
    subject: networks,
    items: [
      { id: "i-4", kind: "LESSON", note: "", lesson: lesson("rascunho", base, { isPublished: false }) },
      { id: "i-5", kind: "PRACTICE", note: "", questionGoal: 10, subject: networks, board: null },
    ],
  },
];

const active = { startsAt: new Date("2026-01-01"), expiresAt: null, revokedAt: null };

describe("visão da trilha", () => {
  it("visitante: aula grátis aberta, as outras bloqueadas (sem matrícula); rascunho some; nada feito", () => {
    const view = buildTrackView({ sections, role: undefined, enrollmentByCourse: new Map(), completedLessonIds: new Set(), practiceStats: [], now: NOW });
    const [first, second] = view.sections;
    expect(first.items.map((item) => item.id)).toEqual(["i-1", "i-2", "i-3"]);
    expect(first.items[0]).toMatchObject({ kind: "LESSON", access: { allowed: true, reason: "FREE_PREVIEW" }, href: "/cursos/curso-base/aulas/backup" });
    expect(first.items[1]).toMatchObject({ access: { allowed: false, reason: "NOT_ENROLLED" }, note: "Cai muito" });
    // A aula em rascunho não aparece para quem não é professor/admin.
    expect(second.items.map((item) => item.id)).toEqual(["i-5"]);
    expect(view.summary).toEqual({ done: 0, total: 4, percent: 0 });
    expect(view.nextItemId).toBe("i-1");
  });

  it("o acesso de cada aula vem da matrícula no curso DELA (a trilha não libera nada)", () => {
    const view = buildTrackView({
      sections,
      role: "STUDENT",
      enrollmentByCourse: new Map([["c-base", active]]), // só o Curso Base
      completedLessonIds: new Set(),
      practiceStats: [],
      now: NOW,
    });
    expect(view.sections[0].items[0]).toMatchObject({ access: { allowed: true, reason: "ENROLLED" } });
    expect(view.sections[0].items[1]).toMatchObject({ access: { allowed: false, reason: "NOT_ENROLLED" } });
  });

  it("feito: aula concluída; treino com a meta de questões DIFERENTES (na banca do treino, se houver)", () => {
    const view = buildTrackView({
      sections,
      role: "STUDENT",
      enrollmentByCourse: new Map([["c-base", active], ["c-bb", active]]),
      completedLessonIds: new Set(["backup", "golpes"]),
      practiceStats: [
        { subjectId: "s-seg", boardId: "b-ces", answered: 3, attempts: 4, correct: 3 },
        { subjectId: "s-seg", boardId: "b-fgv", answered: 7, attempts: 7, correct: 7 }, // outra banca: não conta no treino da Cesgranrio
        { subjectId: "s-redes", boardId: "b-fgv", answered: 6, attempts: 8, correct: 4 },
        { subjectId: "s-redes", boardId: null, answered: 4, attempts: 4, correct: 4 },
      ],
      now: NOW,
    });
    const practiceSecurity = view.sections[0].items[2];
    expect(practiceSecurity).toMatchObject({ kind: "PRACTICE", answered: 3, goal: 5, accuracyPercent: 75, done: false, href: "/questoes?assunto=seguranca&banca=cesgranrio" });
    // Treino sem banca: vale qualquer banca (6 + 4 = 10 → meta cumprida).
    expect(view.sections[1].items[0]).toMatchObject({ answered: 10, accuracyPercent: 67, done: true, href: "/questoes?assunto=redes" });
    expect(view.summary).toEqual({ done: 3, total: 4, percent: 75 });
    expect(view.nextItemId).toBe("i-3");
  });

  it("professor vê os rascunhos (com aviso) e tudo liberado; trilha toda feita não tem próximo passo", () => {
    const staff = buildTrackView({ sections, role: "TEACHER", enrollmentByCourse: new Map(), completedLessonIds: new Set(), practiceStats: [], now: NOW });
    expect(staff.sections[1].items[0]).toMatchObject({ id: "i-4", isDraft: true, access: { allowed: true, reason: "STAFF" } });

    const finished = buildTrackView({
      sections: [sections[0]],
      role: "STUDENT",
      enrollmentByCourse: new Map(),
      completedLessonIds: new Set(["backup", "golpes"]),
      practiceStats: [{ subjectId: "s-seg", boardId: "b-ces", answered: 5, attempts: 5, correct: 5 }],
      now: NOW,
    });
    expect(finished.summary).toEqual({ done: 3, total: 3, percent: 100 });
    expect(finished.nextItemId).toBeNull();
  });

  it("etapa sem nenhum passo visível some para o aluno (mas aparece para o professor montar)", () => {
    const onlyDraft: TrackSectionInput[] = [
      { id: "vazia", title: "Em breve", description: "", subject: null, items: [{ id: "x", kind: "LESSON", note: "", lesson: lesson("r", { ...base, isPublished: false }) }] },
    ];
    expect(buildTrackView({ sections: onlyDraft, role: "STUDENT", enrollmentByCourse: new Map(), completedLessonIds: new Set(), practiceStats: [], now: NOW }).sections).toEqual([]);
    expect(buildTrackView({ sections: onlyDraft, role: "ADMIN", enrollmentByCourse: new Map(), completedLessonIds: new Set(), practiceStats: [], now: NOW }).sections).toHaveLength(1);
  });

  it("endereços e contas auxiliares", () => {
    expect(lessonHref({ slug: "a", course: { slug: "c" } })).toBe("/cursos/c/aulas/a");
    expect(practiceHref({ slug: "seguranca" }, null)).toBe("/questoes?assunto=seguranca");
    expect(practiceProgress([], "s", null)).toEqual({ answered: 0, accuracyPercent: null });
  });
});

describe("rascunho pelo 'o que mais cai'", () => {
  it("uma etapa por assunto, do que mais cai para o que menos cai, com as aulas e um treino na banca", () => {
    const draft = buildTrackDraft({
      incidence: [
        { subjectId: "s-redes", name: "Redes", count: 4 },
        { subjectId: "s-seg", name: "Segurança", count: 9 },
        { subjectId: "s-office", name: "Office", count: 4 },
      ],
      lessonIdsBySubject: new Map([
        ["s-seg", ["backup", "golpes"]],
        ["s-redes", ["internet", "golpes"]], // "golpes" já entrou na etapa de Segurança
      ]),
      boardId: "b-ces",
    });
    expect(draft.map((section) => section.title)).toEqual(["Segurança", "Office", "Redes"]); // empate: ordem alfabética
    expect(draft[0].items).toEqual([
      { kind: "LESSON", lessonId: "backup" },
      { kind: "LESSON", lessonId: "golpes" },
      { kind: "PRACTICE", subjectId: "s-seg", boardId: "b-ces", questionGoal: 10 },
    ]);
    // Assunto sem aula ainda: a etapa tem só o treino.
    expect(draft[1].items).toEqual([{ kind: "PRACTICE", subjectId: "s-office", boardId: "b-ces", questionGoal: 10 }]);
    expect(draft[2].items).toEqual([
      { kind: "LESSON", lessonId: "internet" },
      { kind: "PRACTICE", subjectId: "s-redes", boardId: "b-ces", questionGoal: 10 },
    ]);
  });
});
