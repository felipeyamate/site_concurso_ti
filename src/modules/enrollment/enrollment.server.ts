/**
 * enrollment.server.ts — Consultas de matrículas e o acesso a uma aula específica.
 *
 * Quem chama: páginas do curso/aula, área do aluno e as ações que salvam progresso.
 * A DECISÃO de acesso fica em `access.ts` (regra pura); aqui só buscamos os dados para ela.
 *
 * Fase 4: um aluno pode ter até uma matrícula por ORIGEM no mesmo curso (manual, compra,
 * assinatura). Aqui elas são juntadas numa só com `mergeEnrollments` — o resto do app continua
 * vendo "a matrícula do aluno no curso".
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import { checkLessonAccess, getEnrollmentStatus, mergeEnrollments, type EnrollmentSnapshot, type LessonAccess } from "./access";

const enrollmentSnapshotSelect = { startsAt: true, expiresAt: true, revokedAt: true } as const;

/** A matrícula que vale para a pessoa no curso (ativa ou não), ou `null`. */
export async function getEnrollment(
  userId: string,
  courseId: string,
  now: Date = new Date(),
): Promise<EnrollmentSnapshot | null> {
  const rows = await prisma.enrollment.findMany({
    where: { userId, courseId },
    select: enrollmentSnapshotSelect,
  });
  return mergeEnrollments(rows, now);
}

/**
 * Todas as matrículas da pessoa, uma por curso (já juntando as origens), com o ID do curso.
 * A área do aluno usa para listar "Meus cursos".
 */
export async function listEnrollments(
  userId: string,
  now: Date = new Date(),
): Promise<Array<EnrollmentSnapshot & { courseId: string }>> {
  const rows = await prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true, ...enrollmentSnapshotSelect },
  });

  // Agrupa por curso (como um `defaultdict(list)` do Python) e junta cada grupo.
  const byCourse = new Map<string, EnrollmentSnapshot[]>();
  for (const { courseId, ...snapshot } of rows) {
    byCourse.set(courseId, [...(byCourse.get(courseId) ?? []), snapshot]);
  }
  const merged: Array<EnrollmentSnapshot & { courseId: string }> = [];
  for (const [courseId, group] of byCourse) {
    const enrollment = mergeEnrollments(group, now);
    if (enrollment) merged.push({ courseId, ...enrollment });
  }
  return merged;
}

/**
 * A pessoa tem ALGUMA matrícula ativa agora (em qualquer curso, de qualquer origem)?
 * Usada pelo banco de questões (Fase 5): questões sem limite e simulados são de quem é aluno.
 * `db` = o cliente do banco ou a transação em andamento (para conferir dentro de uma trava).
 */
export async function hasAnyActiveEnrollment(
  userId: string,
  now: Date = new Date(),
  db: Pick<Prisma.TransactionClient, "enrollment"> = prisma,
): Promise<boolean> {
  const rows = await db.enrollment.findMany({ where: { userId, revokedAt: null }, select: enrollmentSnapshotSelect });
  return rows.some((row) => getEnrollmentStatus(row, now) === "ACTIVE");
}

export type LessonAccessResult = {
  lesson: { id: string; slug: string; courseId: string; courseSlug: string };
  access: LessonAccess;
} | null;

/**
 * Busca a aula pelo ID e decide se a pessoa pode assisti-la.
 * Usada pelas ações do servidor, que recebem só o ID da aula vindo do navegador.
 * Devolve `null` se a aula não existe.
 */
export async function getLessonAccessForUser(params: {
  userId: string;
  role: unknown;
  lessonId: string;
  now?: Date;
}): Promise<LessonAccessResult> {
  const now = params.now ?? new Date();
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: {
      id: true,
      slug: true,
      courseId: true,
      isPublished: true,
      isFreePreview: true,
      course: { select: { slug: true, isPublished: true } },
    },
  });
  if (!lesson) return null;

  const enrollment = await getEnrollment(params.userId, lesson.courseId, now);
  const access = checkLessonAccess({
    role: params.role,
    isCoursePublished: lesson.course.isPublished,
    isLessonPublished: lesson.isPublished,
    isFreePreview: lesson.isFreePreview,
    enrollment,
    now,
  });

  return {
    lesson: { id: lesson.id, slug: lesson.slug, courseId: lesson.courseId, courseSlug: lesson.course.slug },
    access,
  };
}
