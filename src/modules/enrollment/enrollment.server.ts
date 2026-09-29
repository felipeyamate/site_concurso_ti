/**
 * enrollment.server.ts — Consultas de matrículas e o acesso a uma aula específica.
 *
 * Quem chama: páginas do curso/aula, área do aluno e as ações que salvam progresso.
 * A DECISÃO de acesso fica em `access.ts` (regra pura); aqui só buscamos os dados para ela.
 */
import "server-only";

import { prisma } from "@/lib/db";

import { checkLessonAccess, type EnrollmentSnapshot, type LessonAccess } from "./access";

const enrollmentSnapshotSelect = { startsAt: true, expiresAt: true, revokedAt: true } as const;

/** A matrícula da pessoa no curso (ativa ou não), ou `null`. */
export async function getEnrollment(userId: string, courseId: string): Promise<EnrollmentSnapshot | null> {
  return prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: enrollmentSnapshotSelect,
  });
}

/** Todas as matrículas da pessoa, com o ID do curso (a área do aluno filtra as ativas). */
export async function listEnrollments(userId: string) {
  return prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true, ...enrollmentSnapshotSelect },
  });
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

  const enrollment = await getEnrollment(params.userId, lesson.courseId);
  const access = checkLessonAccess({
    role: params.role,
    isCoursePublished: lesson.course.isPublished,
    isLessonPublished: lesson.isPublished,
    isFreePreview: lesson.isFreePreview,
    enrollment,
    now: params.now ?? new Date(),
  });

  return {
    lesson: { id: lesson.id, slug: lesson.slug, courseId: lesson.courseId, courseSlug: lesson.course.slug },
    access,
  };
}
