/**
 * tracks.test.ts — Testes de integração da Fase 8: trilhas de estudo (painel, "montar pelo que mais
 * cai", ordem das etapas e passos, proteções), a visão do aluno (acesso pela matrícula, progresso) e a
 * ligação aula ↔ assunto ("estude esta aula") — com PostgreSQL de verdade.
 *
 * Rodar: npm run test:integration   (exige TEST_DATABASE_URL — ver README)
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { deleteCourse, deleteLesson, setLessonSubjects } from "@/modules/catalog/admin/catalog-admin.server";
import { listLessonSubjects, listStudyLessonsBySubject } from "@/modules/catalog/lesson-subjects.server";
import { deleteBoard, deleteSubject } from "@/modules/questions/admin/questions-admin.server";
import { buildSitemapEntries } from "@/modules/seo/feeds.server";
import { findRedirectTarget } from "@/modules/seo/redirects.server";
import { trackSchema } from "@/modules/tracks/schemas";
import {
  addLessonItem,
  addPracticeItem,
  deleteItem,
  deleteSection,
  deleteTrack,
  fillTrackFromIncidence,
  getTrackForAdmin,
  moveItem,
  moveSection,
  saveSection,
  saveTrack,
  setTrackPublished,
  updateItem,
} from "@/modules/tracks/tracks-admin.server";
import { getTrackBySlug, getTrackView, listPublishedTracks } from "@/modules/tracks/tracks.server";

const T0 = new Date("2026-10-02T15:00:00.000Z");

async function reset() {
  await prisma.track.deleteMany({ where: { slug: { startsWith: "tr-" } } });
  await prisma.slugRedirect.deleteMany({ where: { kind: "TRACK" } });
  await prisma.questionAttempt.deleteMany({ where: { userId: { startsWith: "tr-" } } });
  await prisma.enrollment.deleteMany({ where: { userId: { startsWith: "tr-" } } });
  await prisma.lessonProgress.deleteMany({ where: { userId: { startsWith: "tr-" } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: "tr-" } } });
  await prisma.course.deleteMany({ where: { slug: { startsWith: "tr-" } } });
  await prisma.question.deleteMany({ where: { code: { startsWith: "TR-" } } });
  await prisma.exam.deleteMany({ where: { slug: { startsWith: "tr-" } } });
  await prisma.subject.deleteMany({ where: { slug: { startsWith: "tr-" } } });
  await prisma.board.deleteMany({ where: { slug: { startsWith: "tr-" } } });
}

const track = (input: Record<string, unknown>) =>
  trackSchema.parse({ title: "Trilha de teste", slug: "", summary: "", body: "", boardId: "", productId: "", planId: "", ...input });

/**
 * O cenário: banca "TR Banca" com questões de prova (Segurança cai 3 vezes, Redes 1); o Curso Base
 * (publicado) com 3 aulas e um curso "específico" com 1 aula; aulas ligadas aos assuntos.
 */
async function setup() {
  const board = await prisma.board.create({ data: { slug: "tr-banca", name: "TR Banca" } });
  const otherBoard = await prisma.board.create({ data: { slug: "tr-outra", name: "TR Outra" } });
  const security = await prisma.subject.create({ data: { slug: "tr-seguranca", name: "TR Segurança", position: 1 } });
  const networks = await prisma.subject.create({ data: { slug: "tr-redes", name: "TR Redes", position: 2 } });
  const office = await prisma.subject.create({ data: { slug: "tr-office", name: "TR Office", position: 3 } });
  const exam = await prisma.exam.create({ data: { slug: "tr-prova", name: "TR Prova", year: 2025, boardId: board.id } });
  const question = (code: string, subjectId: string, boardId = board.id, examId: string | null = exam.id) =>
    prisma.question.create({
      data: {
        code,
        type: "MULTIPLE_CHOICE",
        statement: code,
        correctAnswer: "A",
        explanation: "Comentário",
        subjectId,
        boardId,
        examId,
        isPublished: true,
        options: { create: ["A", "B"].map((label) => ({ label, text: label })) },
      },
    });
  const questions = [
    await question("TR-S1", security.id),
    await question("TR-S2", security.id),
    await question("TR-S3", security.id),
    await question("TR-R1", networks.id),
    await question("TR-X1", security.id, otherBoard.id, null), // inédita de outra banca
  ];

  const base = await prisma.course.create({ data: { slug: "tr-base", title: "TR Curso Base", description: "", isPublished: true, position: 1 } });
  const baseModule = await prisma.module.create({ data: { courseId: base.id, title: "Módulo", position: 1 } });
  const lesson = (courseId: string, moduleId: string, slug: string, position: number, extra: Record<string, unknown> = {}) =>
    prisma.lesson.create({ data: { courseId, moduleId, slug, title: `Aula ${slug}`, position, ...extra } });
  const backup = await lesson(base.id, baseModule.id, "backup", 1, { isFreePreview: true });
  const phishing = await lesson(base.id, baseModule.id, "phishing", 2);
  const internet = await lesson(base.id, baseModule.id, "internet", 3);
  const draftLesson = await lesson(base.id, baseModule.id, "rascunho", 4, { isPublished: false });
  const specific = await prisma.course.create({ data: { slug: "tr-especifico", title: "TR Específico", description: "", isPublished: true, position: 2 } });
  const specificModule = await prisma.module.create({ data: { courseId: specific.id, title: "Módulo", position: 1 } });
  const bbSecurity = await lesson(specific.id, specificModule.id, "seguranca-bb", 1);

  await setLessonSubjects({ lessonId: backup.id, subjectIds: [security.id] });
  await setLessonSubjects({ lessonId: phishing.id, subjectIds: [security.id, networks.id] });
  await setLessonSubjects({ lessonId: internet.id, subjectIds: [networks.id] });
  await setLessonSubjects({ lessonId: draftLesson.id, subjectIds: [security.id] });
  await setLessonSubjects({ lessonId: bbSecurity.id, subjectIds: [security.id] });
  return { board, otherBoard, security, networks, office, exam, questions, base, specific, backup, phishing, internet, draftLesson, bbSecurity };
}

let s: Awaited<ReturnType<typeof setup>>;

beforeEach(async () => {
  await reset();
  s = await setup();
});

afterAll(async () => {
  await reset();
});

describe("aula ↔ assunto", () => {
  it("'estude esta aula': aulas publicadas do assunto, na ordem do catálogo, até o limite", async () => {
    const bySubject = await listStudyLessonsBySubject([s.security.id, s.networks.id, s.office.id]);
    expect(bySubject.get(s.security.id)?.map((lesson) => lesson.title)).toEqual(["Aula backup", "Aula phishing"]); // limite de 2; rascunho fora
    expect(bySubject.get(s.networks.id)?.map((lesson) => lesson.href)).toEqual(["/cursos/tr-base/aulas/phishing", "/cursos/tr-base/aulas/internet"]);
    expect(bySubject.has(s.office.id)).toBe(false);
    const all = await listStudyLessonsBySubject([s.security.id], { includeDrafts: true, perSubject: 10 });
    expect(all.get(s.security.id)?.map((lesson) => lesson.title)).toEqual(["Aula backup", "Aula phishing", "Aula rascunho", "Aula seguranca-bb"]);
    expect((await listLessonSubjects(s.phishing.id)).map((subject) => subject.name)).toEqual(["TR Segurança", "TR Redes"]);
  });

  it("trocar a lista substitui a anterior; assunto inexistente é recusado", async () => {
    await setLessonSubjects({ lessonId: s.phishing.id, subjectIds: [s.office.id] });
    expect((await listLessonSubjects(s.phishing.id)).map((subject) => subject.name)).toEqual(["TR Office"]);
    await expect(setLessonSubjects({ lessonId: s.phishing.id, subjectIds: ["nao-existe"] })).rejects.toThrow(/não existe mais/);
  });
});

describe("painel: montar pelo 'o que mais cai'", () => {
  it("cria a trilha com uma etapa por assunto da banca (do que mais cai), com as aulas e um treino na banca", async () => {
    const created = await saveTrack(track({ title: "TR Trilha Banca", boardId: s.board.id, fromIncidence: "on" }), T0);
    expect(created.slug).toBe("tr-trilha-banca");
    const admin = await getTrackForAdmin(created.id);
    expect(admin?.sections.map((section) => [section.position, section.title, section.subject?.id])).toEqual([
      [1, "TR Segurança", s.security.id],
      [2, "TR Redes", s.networks.id],
    ]);
    const describeItem = (item: { kind: string; lesson: { title: string } | null; subject: { name: string } | null; board: { name: string } | null; questionGoal: number }) =>
      item.kind === "LESSON" ? item.lesson?.title : `treino ${item.subject?.name} ${item.board?.name} ${item.questionGoal}`;
    // Rascunhos entram (o aluno não os vê); "phishing" (dois assuntos) aparece só na primeira etapa.
    expect(admin?.sections[0].items.map(describeItem)).toEqual(["Aula backup", "Aula phishing", "Aula rascunho", "Aula seguranca-bb", "treino TR Segurança TR Banca 10"]);
    expect(admin?.sections[1].items.map(describeItem)).toEqual(["Aula internet", "treino TR Redes TR Banca 10"]);
  });

  it("sem banca, ou banca sem questões de prova: explica; em trilha com etapas, não monta de novo", async () => {
    await expect(saveTrack(track({ title: "TR Sem banca", fromIncidence: "on" }))).rejects.toThrow(/Escolha a banca/);
    await expect(saveTrack(track({ title: "TR Outra banca", boardId: s.otherBoard.id, fromIncidence: "on" }))).rejects.toThrow(/ainda não tem questões de prova/);

    const empty = await saveTrack(track({ title: "TR Vazia", boardId: s.board.id }));
    await fillTrackFromIncidence(empty.id);
    expect(await prisma.trackSection.count({ where: { trackId: empty.id } })).toBe(2);
    await expect(fillTrackFromIncidence(empty.id)).rejects.toThrow(/já tem etapas/);
  });

  it("publicar: data da 1ª publicação; trocar o endereço grava o antigo; apagar leva junto os antigos", async () => {
    const created = await saveTrack(track({ title: "TR Publicar" }), T0);
    await setTrackPublished(created.id, true, new Date(T0.getTime() + 1000));
    await saveTrack(track({ trackId: created.id, title: "TR Publicar", slug: "tr-publicar-nova", isPublished: "on" }), new Date(T0.getTime() + 2000));
    const saved = await prisma.track.findUniqueOrThrow({ where: { id: created.id } });
    expect(saved).toMatchObject({ slug: "tr-publicar-nova", publishedAt: new Date(T0.getTime() + 1000) });
    expect(await findRedirectTarget("TRACK", "tr-publicar")).toBe(created.id);
    await expect(saveTrack(track({ title: "TR Outra", slug: "tr-publicar-nova" }))).rejects.toThrow(/Já existe uma trilha com este endereço/);
    await deleteTrack(created.id);
    expect(await findRedirectTarget("TRACK", "tr-publicar")).toBeNull();
  });
});

describe("painel: etapas e passos em ordem", () => {
  it("etapas e passos: incluir, mover, mudar de etapa e apagar mantêm as posições 1, 2, 3...", async () => {
    const { id: trackId } = await saveTrack(track({ title: "TR Ordem", boardId: s.board.id }));
    const a = await saveSection({ trackId, sectionId: null, title: "Etapa A", description: "", subjectId: null });
    const b = await saveSection({ trackId, sectionId: null, title: "Etapa B", description: "", subjectId: s.networks.id });
    await addLessonItem({ sectionId: a.id, lessonId: s.backup.id, note: "" });
    await addLessonItem({ sectionId: a.id, lessonId: s.phishing.id, note: "" });
    await addPracticeItem({ sectionId: a.id, subjectId: s.security.id, boardId: s.board.id, questionGoal: 5, note: "Cai sempre" });
    // A mesma aula não entra duas vezes na trilha.
    await expect(addLessonItem({ sectionId: b.id, lessonId: s.backup.id, note: "" })).rejects.toThrow(/já está na trilha/);

    const itemsOf = async (sectionId: string) =>
      (await prisma.trackItem.findMany({ where: { sectionId }, orderBy: { position: "asc" }, select: { position: true, lessonId: true, kind: true } })).map(
        (item) => [item.position, item.lessonId ?? item.kind],
      );
    const [first, second, practice] = await prisma.trackItem.findMany({ where: { sectionId: a.id }, orderBy: { position: "asc" } });
    await moveItem(second.id, "up");
    expect(await itemsOf(a.id)).toEqual([[1, s.phishing.id], [2, s.backup.id], [3, "PRACTICE"]]);

    // Mudar de etapa: vai para o fim da nova; as seguintes da antiga sobem.
    await updateItem({ itemId: first.id, sectionId: b.id, note: "Revise", boardId: null, questionGoal: undefined });
    expect(await itemsOf(a.id)).toEqual([[1, s.phishing.id], [2, "PRACTICE"]]);
    expect(await itemsOf(b.id)).toEqual([[1, s.backup.id]]);
    // Treino: a meta é obrigatória ao editar.
    await expect(updateItem({ itemId: practice.id, sectionId: a.id, note: "", boardId: null, questionGoal: undefined })).rejects.toThrow(/meta/);
    await updateItem({ itemId: practice.id, sectionId: a.id, note: "", boardId: null, questionGoal: 20 });
    expect(await prisma.trackItem.findUniqueOrThrow({ where: { id: practice.id } })).toMatchObject({ questionGoal: 20, boardId: null });

    await deleteItem(second.id);
    expect(await itemsOf(a.id)).toEqual([[1, "PRACTICE"]]);
    await moveSection(b.id, "up");
    expect((await prisma.trackSection.findMany({ where: { trackId }, orderBy: { position: "asc" } })).map((section) => section.title)).toEqual(["Etapa B", "Etapa A"]);
    await deleteSection(b.id);
    expect((await prisma.trackSection.findMany({ where: { trackId } })).map((section) => [section.position, section.title])).toEqual([[1, "Etapa A"]]);
  });

  it("dois passos incluídos AO MESMO TEMPO na mesma etapa ganham posições diferentes (trava da trilha)", async () => {
    const { id: trackId } = await saveTrack(track({ title: "TR Simultâneo" }));
    const section = await saveSection({ trackId, sectionId: null, title: "Etapa", description: "", subjectId: null });
    await Promise.all([
      addLessonItem({ sectionId: section.id, lessonId: s.backup.id, note: "" }),
      addLessonItem({ sectionId: section.id, lessonId: s.phishing.id, note: "" }),
      addPracticeItem({ sectionId: section.id, subjectId: s.security.id, boardId: null, questionGoal: 10, note: "" }),
    ]);
    const positions = (await prisma.trackItem.findMany({ where: { sectionId: section.id }, select: { position: true } })).map((item) => item.position).sort();
    expect(positions).toEqual([1, 2, 3]);
  });

  it("aula, curso, assunto e banca usados numa trilha não se apagam (o painel explica)", async () => {
    const { id: trackId } = await saveTrack(track({ title: "TR Protege" }));
    const section = await saveSection({ trackId, sectionId: null, title: "Etapa", description: "", subjectId: null });
    await addLessonItem({ sectionId: section.id, lessonId: s.bbSecurity.id, note: "" });
    const emptyBoard = await prisma.board.create({ data: { slug: "tr-sem-questoes", name: "TR Sem questões" } });
    await addPracticeItem({ sectionId: section.id, subjectId: s.office.id, boardId: emptyBoard.id, questionGoal: 10, note: "" });
    await expect(deleteLesson(s.bbSecurity.id)).rejects.toThrow(/está na trilha "TR Protege"/);
    await expect(deleteCourse(s.specific.id)).rejects.toThrow(/estão na trilha "TR Protege"/);
    await expect(deleteSubject(s.office.id)).rejects.toThrow(/trilha "TR Protege"/);
    await expect(deleteBoard(emptyBoard.id)).rejects.toThrow(/trilha "TR Protege"/);
    // Fora da trilha, a aula volta a poder ser apagada.
    const item = await prisma.trackItem.findFirstOrThrow({ where: { lessonId: s.bbSecurity.id } });
    await deleteItem(item.id);
    await deleteLesson(s.bbSecurity.id);
  });
});

describe("visão do aluno", () => {
  async function publishedTrack() {
    const created = await saveTrack(track({ title: "TR Aluno", boardId: s.board.id, fromIncidence: "on", isPublished: "on" }), T0);
    return (await getTrackBySlug(created.slug, false))!;
  }

  it("rascunho só com canSeeDrafts; a lista mostra só as publicadas, contando só aulas publicadas", async () => {
    const draft = await saveTrack(track({ title: "TR Rascunho", boardId: s.board.id, fromIncidence: "on" }));
    expect(await getTrackBySlug(draft.slug, false)).toBeNull();
    expect(await getTrackBySlug(draft.slug, true)).not.toBeNull();
    await publishedTrack();
    const cards = (await listPublishedTracks()).filter((card) => card.slug.startsWith("tr-"));
    expect(cards.map((card) => [card.title, card.lessonCount, card.practiceCount])).toEqual([["TR Aluno", 4, 2]]); // a aula rascunho não conta
    // A página mostra quanto cada assunto cai na banca (3 de 4 questões de prova = 75%).
    const page = await getTrackBySlug("tr-aluno", false);
    expect(page?.percentBySubject.get(s.security.id)).toBe(75);
  });

  it("aula: acesso pela matrícula no curso DELA; feito = concluída. Treino: questões diferentes na banca", async () => {
    const page = await publishedTrack();
    await prisma.user.create({ data: { id: "tr-aluna", name: "Aluna", email: "tr-aluna@exemplo.com" } });
    // Matrícula só no Curso Base.
    await prisma.enrollment.create({ data: { userId: "tr-aluna", courseId: s.base.id, source: "MANUAL", startsAt: new Date("2026-01-01") } });
    await prisma.lessonProgress.create({ data: { userId: "tr-aluna", lessonId: s.backup.id, positionSeconds: 60, completedAt: T0, lastWatchedAt: T0 } });
    // Segurança na banca: 2 questões diferentes (uma repetida) + 1 de outra banca (não conta no treino da banca).
    const [s1, s2] = s.questions;
    const x1 = s.questions[4];
    await prisma.questionAttempt.createMany({
      data: [
        { userId: "tr-aluna", questionId: s1.id, answer: "A", isCorrect: true, source: "PRACTICE", answeredAt: T0 },
        { userId: "tr-aluna", questionId: s1.id, answer: "B", isCorrect: false, source: "PRACTICE", answeredAt: T0 },
        { userId: "tr-aluna", questionId: s2.id, answer: "A", isCorrect: true, source: "PRACTICE", answeredAt: T0 },
        { userId: "tr-aluna", questionId: x1.id, answer: "A", isCorrect: true, source: "PRACTICE", answeredAt: T0 },
      ],
    });

    const view = await getTrackView(page.sections, { userId: "tr-aluna", role: "STUDENT" }, T0);
    const items = view.sections.flatMap((section) => section.items);
    const byLesson = (lessonId: string) => items.find((item) => item.kind === "LESSON" && item.lesson.id === lessonId);
    expect(byLesson(s.backup.id)).toMatchObject({ done: true, access: { allowed: true, reason: "ENROLLED" } });
    expect(byLesson(s.bbSecurity.id)).toMatchObject({ done: false, access: { allowed: false, reason: "NOT_ENROLLED" } });
    expect(byLesson(s.draftLesson.id)).toBeUndefined(); // rascunho não aparece para o aluno
    const securityPractice = items.find((item) => item.kind === "PRACTICE" && item.subject.id === s.security.id);
    expect(securityPractice).toMatchObject({ answered: 2, accuracyPercent: 67, goal: 10, done: false });
    expect(view.summary).toEqual({ done: 1, total: 6, percent: 16 });

    // Visitante: nada feito; a aula grátis abre (a página pede login), as outras explicam o bloqueio.
    const visitor = await getTrackView(page.sections, null, T0);
    expect(visitor.summary.done).toBe(0);
    expect(visitor.sections[0].items[0]).toMatchObject({ access: { allowed: true, reason: "FREE_PREVIEW" } });
  });

  it("o sitemap lista as trilhas publicadas", async () => {
    await publishedTrack();
    const urls = (await buildSitemapEntries()).map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/trilhas/tr-aluno"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/trilhas"))).toBe(true);
  });
});
