/**
 * admin.test.ts — Testes de integração da Fase 3: painel de cursos, materiais em PDF, perfis e
 * matrículas manuais, com PostgreSQL de verdade (e o armazenamento LOCAL numa pasta temporária).
 *
 * Rodar: npm run test:integration   (exige TEST_DATABASE_URL — ver README)
 *
 * Os cursos criados aqui começam com "Teste Admin" e são apagados no fim, para não atrapalhar
 * os outros arquivos de teste (que esperam só os cursos do seed).
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";
import { changeUserRole, listUsersForAdmin } from "@/modules/auth/admin-users.server";
import {
  createCourse,
  createLesson,
  createModule,
  deleteCourse,
  deleteLesson,
  deleteModule,
  moveLesson,
  moveModule,
  updateCourse,
  updateLesson,
  updateLessonVideo,
} from "@/modules/catalog/admin/catalog-admin.server";
import { grantEnrollment, revokeEnrollment } from "@/modules/enrollment/grant";
import {
  confirmAttachmentUpload,
  deleteAttachment,
  getAttachmentDownloadUrl,
  listLessonAttachments,
  prepareAttachmentUpload,
} from "@/modules/materials/materials.server";
import { verifyLocalSignedUrl } from "@/modules/storage/local-signature";
import { createLocalStorage, readLocalObject, writeLocalObject } from "@/modules/storage/local-storage.server";
import type { FileStorage } from "@/modules/storage/types";

const DAY = 24 * 60 * 60 * 1000;
const SECRET = "segredo-de-teste-do-armazenamento-local-32+";
const PANDA_LINK = "https://player-vz-abc123.tv.pandavideo.com.br/embed/?v=9988aabb-ccdd-eeff-1122-334455667788";

let storageDir: string;
let storage: FileStorage;

async function createUser(id: string, role: "STUDENT" | "TEACHER" | "ADMIN" = "STUDENT") {
  return prisma.user.create({ data: { id, name: id, email: `${id}@exemplo.com`, role } });
}

// Um curso com 2 módulos (2 aulas no primeiro, 1 no segundo), todas publicadas.
async function createSampleCourse(title = "Teste Admin Curso") {
  const course = await createCourse({ title });
  const moduleA = await createModule({ courseId: course.id, title: "Módulo A" });
  const moduleB = await createModule({ courseId: course.id, title: "Módulo B" });
  const lesson1 = await createLesson({ moduleId: moduleA.id, title: "Primeira aula" });
  const lesson2 = await createLesson({ moduleId: moduleA.id, title: "Segunda aula" });
  const lesson3 = await createLesson({ moduleId: moduleB.id, title: "Terceira aula" });
  await prisma.course.update({ where: { id: course.id }, data: { isPublished: true } });
  await prisma.lesson.updateMany({ where: { courseId: course.id }, data: { isPublished: true } });
  return { course, moduleA, moduleB, lesson1, lesson2, lesson3 };
}

async function lessonOrder(moduleId: string): Promise<string[]> {
  const lessons = await prisma.lesson.findMany({ where: { moduleId }, orderBy: { position: "asc" } });
  return lessons.map((lesson) => `${lesson.position}:${lesson.title}`);
}

async function removeTestCourses() {
  await prisma.course.deleteMany({ where: { slug: { startsWith: "teste-admin" } } });
}

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), "concurso-ti-storage-"));
  storage = createLocalStorage({ rootDir: storageDir, secret: SECRET });
});

beforeEach(async () => {
  await prisma.user.deleteMany();
  await removeTestCourses();
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await removeTestCourses();
  await rm(storageDir, { recursive: true, force: true });
});

describe("cursos no painel", () => {
  it("curso novo nasce como rascunho, no fim da lista, com endereço gerado (e único)", async () => {
    const first = await createCourse({ title: "Teste Admin Redes" });
    const second = await createCourse({ title: "Teste Admin Redes" });
    expect(first).toMatchObject({ slug: "teste-admin-redes", isPublished: false });
    expect(second.slug).toBe("teste-admin-redes-2");
    expect(second.position).toBeGreaterThan(first.position);
  });

  it("recusa endereço repetido ao editar, apontando o campo", async () => {
    const first = await createCourse({ title: "Teste Admin Um" });
    const second = await createCourse({ title: "Teste Admin Dois" });
    const error = await updateCourse({
      courseId: second.id,
      title: "Dois",
      slug: first.slug,
      subtitle: null,
      description: "",
      isPublished: false,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UserFacingError);
    expect((error as UserFacingError).field).toBe("slug");
  });

  it("não apaga curso com matrícula (nem vencida); sem histórico, apaga tudo e devolve os PDFs", async () => {
    const { course, lesson1 } = await createSampleCourse();
    await createUser("aluno");
    await prisma.enrollment.create({
      data: { userId: "aluno", courseId: course.id, expiresAt: new Date(Date.now() - DAY) },
    });
    await expect(deleteCourse(course.id)).rejects.toThrow(/matrículas/);

    await prisma.enrollment.deleteMany({ where: { courseId: course.id } });
    await prisma.lessonAttachment.create({
      data: {
        lessonId: lesson1.id,
        title: "Resumo",
        fileName: "resumo.pdf",
        storageKey: `lessons/${lesson1.id}/123e4567-e89b-42d3-a456-426614174000.pdf`,
        sizeBytes: 10,
      },
    });
    const keys = await deleteCourse(course.id);
    expect(keys).toEqual([`lessons/${lesson1.id}/123e4567-e89b-42d3-a456-426614174000.pdf`]);
    expect(await prisma.lesson.count({ where: { courseId: course.id } })).toBe(0);
  });
});

describe("módulos e aulas no painel", () => {
  it("aulas novas nascem como rascunho, sem vídeo, no fim do módulo, com endereço único no curso", async () => {
    const course = await createCourse({ title: "Teste Admin Aulas" });
    const courseModule = await createModule({ courseId: course.id, title: "Módulo" });
    const first = await createLesson({ moduleId: courseModule.id, title: "Hardware" });
    const second = await createLesson({ moduleId: courseModule.id, title: "Hardware" });
    expect(first).toMatchObject({ slug: "hardware", position: 1, isPublished: false, videoId: null });
    expect(second).toMatchObject({ slug: "hardware-2", position: 2 });
  });

  it("reordena aulas e módulos (↑/↓) mantendo as posições 1, 2, 3...", async () => {
    const { course, moduleA, moduleB, lesson2 } = await createSampleCourse();
    await moveLesson(lesson2.id, "up");
    expect(await lessonOrder(moduleA.id)).toEqual(["1:Segunda aula", "2:Primeira aula"]);
    await moveLesson(lesson2.id, "up"); // já é a primeira: nada muda
    expect(await lessonOrder(moduleA.id)).toEqual(["1:Segunda aula", "2:Primeira aula"]);

    await moveModule(moduleB.id, "up");
    const modules = await prisma.module.findMany({ where: { courseId: course.id }, orderBy: { position: "asc" } });
    expect(modules.map((item) => `${item.position}:${item.title}`)).toEqual(["1:Módulo B", "2:Módulo A"]);
  });

  it("mover a aula para outro módulo a coloca no fim dele; módulo de outro curso é recusado", async () => {
    const { moduleA, moduleB, lesson1 } = await createSampleCourse();
    const other = await createSampleCourse("Teste Admin Outro");
    const base = { lessonId: lesson1.id, title: "Primeira aula", slug: lesson1.slug, description: "", isFreePreview: false, isPublished: true };

    await updateLesson({ ...base, moduleId: moduleB.id });
    expect(await lessonOrder(moduleB.id)).toEqual(["1:Terceira aula", "2:Primeira aula"]);
    expect(await lessonOrder(moduleA.id)).toEqual(["2:Segunda aula"]);

    await expect(updateLesson({ ...base, moduleId: other.moduleA.id })).rejects.toThrow(/módulo deste curso/);
  });

  it("só apaga módulo vazio, e fecha a numeração", async () => {
    const { course, moduleA, moduleB, lesson3 } = await createSampleCourse();
    await expect(deleteModule(moduleB.id)).rejects.toThrow(/ainda tem aulas/);
    await deleteLesson(lesson3.id);
    await moveModule(moduleB.id, "up"); // B vira o 1º
    await deleteModule(moduleB.id);
    const modules = await prisma.module.findMany({ where: { courseId: course.id } });
    expect(modules.map((item) => [item.id, item.position])).toEqual([[moduleA.id, 1]]);
  });

  it("não apaga aula que um ALUNO assistiu; progresso só de professor não impede", async () => {
    const { lesson1, lesson2 } = await createSampleCourse();
    await createUser("aluno");
    await createUser("prof", "TEACHER");
    await prisma.lessonProgress.create({ data: { userId: "aluno", lessonId: lesson1.id, positionSeconds: 30 } });
    await prisma.lessonProgress.create({ data: { userId: "prof", lessonId: lesson2.id, positionSeconds: 30 } });

    await expect(deleteLesson(lesson1.id)).rejects.toThrow(/Despublique/);
    await expect(deleteLesson(lesson2.id)).resolves.toMatchObject({ storageKeys: [] });
  });

  it("vídeo: link do Panda é conferido e guardado limpo; vídeo de exemplo é recusado em produção", async () => {
    const { lesson1 } = await createSampleCourse();
    const base = { lessonId: lesson1.id, durationSeconds: 754, isProduction: false };

    await expect(updateLessonVideo({ ...base, source: "PANDA", pandaEmbed: "https://evil.com/embed/?v=12345678" })).rejects.toThrow(
      /player do Panda/,
    );

    const iframe = `<iframe src="${PANDA_LINK}&amp;autoplay=true"></iframe>`;
    const saved = await updateLessonVideo({ ...base, source: "PANDA", pandaEmbed: iframe });
    expect(saved).toMatchObject({
      videoProvider: "PANDA",
      videoId: "9988aabb-ccdd-eeff-1122-334455667788",
      videoEmbedUrl: PANDA_LINK,
      durationSeconds: 754,
    });

    await expect(updateLessonVideo({ ...base, source: "DEV", pandaEmbed: "", isProduction: true })).rejects.toThrow(
      /produção/,
    );
    const none = await updateLessonVideo({ ...base, source: "NONE", pandaEmbed: "" });
    expect(none).toMatchObject({ videoId: null, videoEmbedUrl: null });
  });
});

describe("materiais em PDF (armazenamento local)", () => {
  const PDF_BYTES = new TextEncoder().encode("%PDF-1.4 conteúdo de teste");

  // Simula o navegador: pede o link, "envia" o arquivo e confirma.
  async function uploadPdf(lessonId: string, fileName = "Resumo_da_aula.pdf") {
    const { key, target } = await prepareAttachmentUpload({
      storage,
      lessonId,
      fileName,
      sizeBytes: PDF_BYTES.byteLength,
      contentType: "application/pdf",
    });
    expect(target).toMatchObject({ method: "PUT", headers: { "Content-Type": "application/pdf" } });
    await writeLocalObject(storageDir, key, PDF_BYTES);
    const attachment = await confirmAttachmentUpload({ storage, lessonId, key, title: "", fileName });
    return { key, attachment };
  }

  it("envia, lista e apaga um PDF (o arquivo some junto)", async () => {
    const { lesson1 } = await createSampleCourse();
    const { key, attachment } = await uploadPdf(lesson1.id);
    expect(attachment).toMatchObject({ title: "Resumo da aula", fileName: "Resumo_da_aula.pdf", sizeBytes: PDF_BYTES.byteLength });
    expect(await listLessonAttachments(lesson1.id)).toHaveLength(1);

    await deleteAttachment({ storage, attachmentId: attachment.id });
    expect(await listLessonAttachments(lesson1.id)).toHaveLength(0);
    expect(await readLocalObject(storageDir, key)).toBeNull();
  });

  it("recusa arquivo que não é PDF, confirmação sem envio e arquivo de outra aula", async () => {
    const { lesson1, lesson2 } = await createSampleCourse();
    await expect(
      prepareAttachmentUpload({ storage, lessonId: lesson1.id, fileName: "a.exe", sizeBytes: 10, contentType: "application/x-msdownload" }),
    ).rejects.toThrow(/PDF/);

    const { key } = await prepareAttachmentUpload({
      storage,
      lessonId: lesson1.id,
      fileName: "a.pdf",
      sizeBytes: 10,
      contentType: "application/pdf",
    });
    await expect(confirmAttachmentUpload({ storage, lessonId: lesson1.id, key, title: "", fileName: "a.pdf" })).rejects.toThrow(
      /não chegou/,
    );
    await writeLocalObject(storageDir, key, PDF_BYTES);
    await expect(confirmAttachmentUpload({ storage, lessonId: lesson2.id, key, title: "", fileName: "a.pdf" })).rejects.toThrow(
      /inválido/,
    );
  });

  it("download: só com acesso à aula, e o link é assinado e temporário", async () => {
    const { course, lesson1 } = await createSampleCourse();
    const { attachment, key } = await uploadPdf(lesson1.id);
    await createUser("aluno");
    const request = {
      storage,
      attachmentId: attachment.id,
      courseSlug: course.slug,
      lessonSlug: lesson1.slug,
      userId: "aluno",
      role: "STUDENT",
    };

    // Sem matrícula (a aula não é grátis): sem acesso.
    expect(await getAttachmentDownloadUrl(request)).toEqual({ ok: false, reason: "NO_ACCESS" });
    // Endereço de outra aula: "não encontrado" (não revela nada).
    expect(await getAttachmentDownloadUrl({ ...request, lessonSlug: "outra" })).toEqual({ ok: false, reason: "NOT_FOUND" });

    await grantEnrollment(prisma, { userId: "aluno", courseId: course.id, days: 30, now: new Date() });
    const result = await getAttachmentDownloadUrl(request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const verified = verifyLocalSignedUrl({
      secret: SECRET,
      searchParams: new URL(result.url, "http://localhost").searchParams,
      expectedOperation: "download",
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    expect(verified).toMatchObject({ ok: true, params: { key, type: "application/pdf" } });
    // O link vence em 5 minutos.
    const expires = Number(new URL(result.url, "http://localhost").searchParams.get("expires"));
    expect(expires - Date.now() / 1000).toBeLessThanOrEqual(5 * 60 + 1);

    // Revogou: sem acesso de novo. Armazenamento desligado: indisponível.
    await revokeEnrollment(prisma, { userId: "aluno", courseId: course.id, now: new Date() });
    expect(await getAttachmentDownloadUrl(request)).toEqual({ ok: false, reason: "NO_ACCESS" });
    expect(await getAttachmentDownloadUrl({ ...request, role: "TEACHER", storage: null })).toEqual({
      ok: false,
      reason: "STORAGE_UNAVAILABLE",
    });
  });
});

describe("matrículas manuais (mesma regra do script e dos pagamentos)", () => {
  it("matricula, renova somando dias, revoga e recomeça do zero", async () => {
    const { course } = await createSampleCourse();
    await createUser("aluno");
    const now = new Date("2026-01-01T12:00:00Z");

    const first = await grantEnrollment(prisma, { userId: "aluno", courseId: course.id, days: 30, now });
    expect(first.renewed).toBe(false);
    const renewed = await grantEnrollment(prisma, { userId: "aluno", courseId: course.id, days: 10, now });
    expect(renewed.renewed).toBe(true);
    expect(renewed.period.expiresAt?.getTime()).toBe(now.getTime() + 40 * DAY);

    expect(await revokeEnrollment(prisma, { userId: "aluno", courseId: course.id, now })).toBe(true);
    expect(await revokeEnrollment(prisma, { userId: "aluno", courseId: course.id, now })).toBe(false);

    const later = new Date(now.getTime() + DAY);
    const again = await grantEnrollment(prisma, { userId: "aluno", courseId: course.id, days: 30, now: later });
    expect(again.period.startsAt).toEqual(later);
    const row = await prisma.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: "aluno", courseId: course.id } },
    });
    expect(row.revokedAt).toBeNull();
    expect(row.source).toBe("MANUAL");
  });
});

describe("perfis e usuários no painel", () => {
  it("admin promove e rebaixa outras pessoas, mas não a si mesmo", async () => {
    await createUser("admin", "ADMIN");
    await createUser("maria");
    await changeUserRole({ actorId: "admin", userId: "maria", role: "TEACHER" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "maria" } })).role).toBe("TEACHER");
    await expect(changeUserRole({ actorId: "admin", userId: "admin", role: "STUDENT" })).rejects.toThrow(/próprio perfil/);
  });

  it("nunca deixa o site sem administrador", async () => {
    await createUser("unico-admin", "ADMIN");
    // Situação extrema: a ação vinda de alguém que já não é admin (ex.: perfil trocado no meio).
    await expect(changeUserRole({ actorId: "outra-pessoa", userId: "unico-admin", role: "TEACHER" })).rejects.toThrow(
      /única conta de administrador/,
    );
  });

  it("busca por nome ou e-mail, sem diferenciar maiúsculas", async () => {
    await createUser("Joana");
    await createUser("pedro");
    const { users, total } = await listUsersForAdmin({ search: "JOA", page: 1 });
    expect(total).toBe(1);
    expect(users[0].email).toBe("Joana@exemplo.com");
  });
});
