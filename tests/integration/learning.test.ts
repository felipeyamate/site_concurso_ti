/**
 * learning.test.ts — Testes de integração da Fase 2: catálogo, matrículas (acesso) e progresso,
 * com PostgreSQL de verdade.
 *
 * Rodar: npm run test:integration   (exige TEST_DATABASE_URL — ver README)
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { listCatalogSummaries } from "@/modules/catalog/catalog.server";
import { getLessonAccessForUser } from "@/modules/enrollment/enrollment.server";
import { listMyCourseViews } from "@/modules/progress/course-view.server";
import { recordLessonProgress, setLessonCompletion } from "@/modules/progress/progress.server";

import { SEED_COURSES, seedCatalog } from "../../prisma/seed-catalog";

const COURSE = "informatica-e-ti-do-zero";
const DRAFT_COURSE = "ti-banco-do-brasil-cesgranrio";
const DAY = 24 * 60 * 60 * 1000;

let courseId: string;
let freeLessonId: string;
let paidLessonId: string;
let draftLessonId: string;

// Busca o ID de uma aula pelo slug (dentro do curso).
async function lessonId(courseSlug: string, lessonSlug: string): Promise<string> {
  const lesson = await prisma.lesson.findFirstOrThrow({
    where: { slug: lessonSlug, course: { slug: courseSlug } },
    select: { id: true },
  });
  return lesson.id;
}

async function createUser(id: string, role: "STUDENT" | "TEACHER" | "ADMIN" = "STUDENT") {
  return prisma.user.create({ data: { id, name: id, email: `${id}@exemplo.com`, role } });
}

async function enroll(userId: string, overrides: { expiresAt?: Date | null; revokedAt?: Date | null } = {}) {
  return prisma.enrollment.create({
    data: { userId, courseId, startsAt: new Date(Date.now() - DAY), ...overrides },
  });
}

beforeAll(async () => {
  await seedCatalog(prisma);
  courseId = (await prisma.course.findUniqueOrThrow({ where: { slug: COURSE } })).id;
  freeLessonId = await lessonId(COURSE, "como-a-informatica-cai-nas-provas");
  paidLessonId = await lessonId(COURSE, "como-estudar-este-curso");
  draftLessonId = await lessonId(DRAFT_COURSE, "o-que-cai-de-ti-no-bb");
});

// Cada teste começa sem usuários (apagar usuários apaga matrículas e progresso junto).
beforeEach(async () => {
  await prisma.legalConsent.deleteMany(); // aceites da LGPD (Fase 7) não deixam apagar o usuário
  await prisma.user.deleteMany();
});

describe("seed do catálogo", () => {
  it("pode rodar várias vezes sem duplicar nada", async () => {
    const before = await Promise.all([prisma.course.count(), prisma.module.count(), prisma.lesson.count()]);
    const result = await seedCatalog(prisma);
    const after = await Promise.all([prisma.course.count(), prisma.module.count(), prisma.lesson.count()]);
    expect(after).toEqual(before);
    expect(result).toEqual({ courses: 2, modules: 8, lessons: 17 });
  });

  it("volta ao estado dos dados mesmo com aulas trocadas de lugar e aulas a mais no banco", async () => {
    // Bagunça: troca as duas aulas do módulo 1 de posição e cria uma aula que não existe nos dados.
    const [first, second] = await prisma.lesson.findMany({
      where: { course: { slug: COURSE }, module: { position: 1 } },
      orderBy: { position: "asc" },
    });
    await prisma.lesson.update({ where: { id: first.id }, data: { position: 99 } });
    await prisma.lesson.update({ where: { id: second.id }, data: { position: 1 } });
    await prisma.lesson.update({ where: { id: first.id }, data: { position: 2 } });
    await prisma.lesson.create({
      data: { courseId, moduleId: first.moduleId, slug: "aula-intrusa", title: "Intrusa", position: 3 },
    });

    await seedCatalog(prisma);

    const moduleOne = await prisma.lesson.findMany({
      where: { course: { slug: COURSE }, module: { position: 1 } },
      orderBy: { position: "asc" },
      select: { slug: true },
    });
    expect(moduleOne.map((lesson) => lesson.slug)).toEqual(["como-a-informatica-cai-nas-provas", "como-estudar-este-curso"]);
  });

  it("não apaga aulas com progresso de aluno: para antes de gravar qualquer coisa", async () => {
    const moduleOne = await prisma.module.findFirstOrThrow({ where: { courseId, position: 1 } });
    const extra = await prisma.lesson.create({
      data: { courseId, moduleId: moduleOne.id, slug: "aula-com-progresso", title: "Extra", position: 50 },
    });
    await createUser("aluno");
    await prisma.lessonProgress.create({ data: { userId: "aluno", lessonId: extra.id, positionSeconds: 30 } });
    await prisma.course.update({ where: { id: courseId }, data: { title: "Título alterado" } });

    await expect(seedCatalog(prisma)).rejects.toThrow(/aula-com-progresso/);
    // Nada foi gravado: a aula e o progresso continuam, e o título alterado não foi sobrescrito.
    expect(await prisma.lessonProgress.count({ where: { lessonId: extra.id } })).toBe(1);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: courseId } })).title).toBe("Título alterado");

    // Limpeza para os próximos testes.
    await prisma.lesson.delete({ where: { id: extra.id } });
    await seedCatalog(prisma);
  });

  it("o banco recusa uma aula cujo curso é diferente do curso do seu módulo", async () => {
    const draftCourse = await prisma.course.findUniqueOrThrow({ where: { slug: DRAFT_COURSE } });
    await expect(
      prisma.lesson.update({ where: { id: paidLessonId }, data: { courseId: draftCourse.id } }),
    ).rejects.toThrow();
  });
});

describe("vitrine (/cursos)", () => {
  it("resume os cursos com as mesmas contas da grade completa", async () => {
    const [summary] = await listCatalogSummaries({ includeDrafts: false });
    const seed = SEED_COURSES[0];
    const seedLessons = seed.modules.flatMap((seedModule) => seedModule.lessons);
    expect(summary).toMatchObject({
      slug: COURSE,
      moduleCount: seed.modules.length,
      lessonCount: seedLessons.length,
      totalDurationSeconds: seedLessons.reduce((sum, lesson) => sum + lesson.durationMinutes * 60, 0),
    });
  });

  it("aluno não vê rascunhos; professor vê", async () => {
    expect((await listCatalogSummaries({ includeDrafts: false })).map((course) => course.slug)).toEqual([COURSE]);
    expect((await listCatalogSummaries({ includeDrafts: true })).map((course) => course.slug)).toEqual([
      COURSE,
      DRAFT_COURSE,
    ]);
  });
});

describe("acesso às aulas (a matrícula decide)", () => {
  const access = async (userId: string, role: string, id: string) =>
    (await getLessonAccessForUser({ userId, role, lessonId: id }))?.access;

  it("aluno sem matrícula: só a aula grátis", async () => {
    await createUser("aluno");
    expect(await access("aluno", "STUDENT", freeLessonId)).toEqual({ allowed: true, reason: "FREE_PREVIEW" });
    expect(await access("aluno", "STUDENT", paidLessonId)).toEqual({ allowed: false, reason: "NOT_ENROLLED" });
  });

  it("matrícula ativa libera; vencida e revogada bloqueiam", async () => {
    await createUser("ativo");
    await enroll("ativo");
    expect((await access("ativo", "STUDENT", paidLessonId))?.allowed).toBe(true);

    await createUser("vencido");
    await enroll("vencido", { expiresAt: new Date(Date.now() - 1000) });
    expect(await access("vencido", "STUDENT", paidLessonId)).toEqual({ allowed: false, reason: "ENROLLMENT_EXPIRED" });

    await createUser("revogado");
    await enroll("revogado", { revokedAt: new Date() });
    expect(await access("revogado", "STUDENT", paidLessonId)).toEqual({ allowed: false, reason: "ENROLLMENT_REVOKED" });
  });

  it("rascunho: aluno não acessa; professor acessa", async () => {
    await createUser("aluno");
    await createUser("prof", "TEACHER");
    expect(await access("aluno", "STUDENT", draftLessonId)).toEqual({ allowed: false, reason: "NOT_PUBLISHED" });
    expect(await access("prof", "TEACHER", draftLessonId)).toEqual({ allowed: true, reason: "STAFF" });
  });

  it("aula inexistente devolve null", async () => {
    expect(await getLessonAccessForUser({ userId: "x", role: "STUDENT", lessonId: "nao-existe" })).toBeNull();
  });
});

describe("progresso", () => {
  it("salva a posição e conclui ao passar de 90%", async () => {
    await createUser("aluno");
    const first = await recordLessonProgress({
      userId: "aluno",
      lessonId: paidLessonId,
      positionSeconds: 120.8,
      durationSeconds: 600,
      ended: false,
    });
    expect(first.completed).toBe(false);

    const second = await recordLessonProgress({
      userId: "aluno",
      lessonId: paidLessonId,
      positionSeconds: 545,
      durationSeconds: 600,
      ended: false,
    });
    expect(second.completed).toBe(true);

    const row = await prisma.lessonProgress.findUniqueOrThrow({
      where: { userId_lessonId: { userId: "aluno", lessonId: paidLessonId } },
    });
    expect(row.positionSeconds).toBe(545);
    expect(row.completedAt).not.toBeNull();
  });

  it("depois de 'desmarcar', salvar em 95% sem a conclusão por posição NÃO conclui de novo", async () => {
    await createUser("aluno");
    await setLessonCompletion({ userId: "aluno", lessonId: paidLessonId, completed: false });
    const result = await recordLessonProgress({
      userId: "aluno",
      lessonId: paidLessonId,
      positionSeconds: 570,
      durationSeconds: 600,
      ended: false,
      completeByPosition: false,
    });
    expect(result.completed).toBe(false);
  });

  it("assistir de novo do começo NÃO desfaz a conclusão; só o botão desmarca", async () => {
    await createUser("aluno");
    await recordLessonProgress({ userId: "aluno", lessonId: paidLessonId, positionSeconds: 600, durationSeconds: 600, ended: true });
    const again = await recordLessonProgress({
      userId: "aluno",
      lessonId: paidLessonId,
      positionSeconds: 10,
      durationSeconds: 600,
      ended: false,
    });
    expect(again.completed).toBe(true);

    await setLessonCompletion({ userId: "aluno", lessonId: paidLessonId, completed: false });
    const row = await prisma.lessonProgress.findUniqueOrThrow({
      where: { userId_lessonId: { userId: "aluno", lessonId: paidLessonId } },
    });
    expect(row.completedAt).toBeNull();
  });
});

describe("meus cursos (área do aluno)", () => {
  it("aluno vê os cursos em que está matriculado, com o progresso", async () => {
    await createUser("aluno");
    expect(await listMyCourseViews({ userId: "aluno", role: "STUDENT" })).toHaveLength(0);

    await enroll("aluno");
    await setLessonCompletion({ userId: "aluno", lessonId: freeLessonId, completed: true });
    const views = await listMyCourseViews({ userId: "aluno", role: "STUDENT" });
    expect(views.map((view) => view.curriculum.slug)).toEqual([COURSE]);
    expect(views[0].summary).toMatchObject({ completed: 1, total: 16 });
    expect(views[0].resumeLesson?.id).toBe(paidLessonId); // a próxima depois da concluída
  });

  it("matrícula vencida continua aparecendo (sem acesso, com o motivo e o progresso guardado)", async () => {
    await createUser("exaluno");
    await enroll("exaluno", { expiresAt: new Date(Date.now() - DAY) });
    await setLessonCompletion({ userId: "exaluno", lessonId: paidLessonId, completed: true });

    const [view] = await listMyCourseViews({ userId: "exaluno", role: "STUDENT" });
    expect(view.curriculum.slug).toBe(COURSE);
    expect(view.hasCourseAccess).toBe(false);
    expect(view.enrollmentStatus).toBe("EXPIRED");
    expect(view.summary.completed).toBe(1);
  });

  it("professor vê todos os cursos, inclusive rascunhos", async () => {
    await createUser("prof", "TEACHER");
    const slugs = (await listMyCourseViews({ userId: "prof", role: "TEACHER" })).map((view) => view.curriculum.slug);
    expect(slugs).toEqual([COURSE, DRAFT_COURSE]);
  });
});
