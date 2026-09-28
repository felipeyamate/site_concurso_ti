/**
 * catalog.server.ts — Consultas do catálogo (cursos, módulos e aulas) no banco.
 *
 * Quem chama: as páginas /cursos, /cursos/[curso], a página da aula e a área do aluno.
 * O que devolve: os dados já no formato de `curriculum.ts` (sem campos internos do banco).
 *
 * Importante: estas funções NÃO filtram por permissão. Quem chama decide o que mostrar
 * (com `canViewCourse`, `visibleCurriculum` e `checkLessonAccess`).
 */
import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import type { CourseCurriculum } from "./curriculum";

// Campos de aula que as telas usam (nunca mandamos o `videoId` para o navegador por aqui).
const lessonSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  position: true,
  durationSeconds: true,
  isFreePreview: true,
  isPublished: true,
} as const;

// O que buscar junto com cada curso: módulos e aulas, já em ordem.
const curriculumInclude = {
  modules: {
    orderBy: { position: "asc" },
    include: { lessons: { orderBy: { position: "asc" }, select: lessonSelect } },
  },
} as const;

type CourseWithCurriculum = Prisma.CourseGetPayload<{ include: typeof curriculumInclude }>;

// Converte a linha do banco no formato usado pelas telas (`CourseCurriculum`).
function toCurriculum(course: CourseWithCurriculum): CourseCurriculum {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    isPublished: course.isPublished,
    modules: course.modules.map((courseModule) => ({
      id: courseModule.id,
      title: courseModule.title,
      position: courseModule.position,
      lessons: courseModule.lessons,
    })),
  };
}

/**
 * A grade completa de um curso (inclusive rascunhos), ordenada. `null` se o slug não existe.
 * `cache`: se o título da aba (metadata) e a página pedirem o mesmo curso na mesma requisição,
 * o banco é consultado uma vez só.
 */
export const getCourseCurriculum = cache(async (slug: string): Promise<CourseCurriculum | null> => {
  const course = await prisma.course.findUnique({ where: { slug }, include: curriculumInclude });
  return course ? toCurriculum(course) : null;
});

/**
 * Todos os cursos com a grade, para o catálogo e a área do aluno.
 * `includeDrafts: false` traz só os publicados.
 */
export async function listCoursesWithCurriculum(options: { includeDrafts: boolean }): Promise<CourseCurriculum[]> {
  const courses = await prisma.course.findMany({
    where: options.includeDrafts ? {} : { isPublished: true },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    include: curriculumInclude,
  });
  return courses.map(toCurriculum);
}

/** Os dados de vídeo de uma aula (usados só no servidor, depois de checar o acesso). */
export async function getLessonVideo(lessonId: string) {
  return prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { videoProvider: true, videoId: true },
  });
}
