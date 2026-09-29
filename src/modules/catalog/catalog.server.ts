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
 * Cursos com a grade completa (área do aluno).
 * `includeDrafts: false` traz só os publicados; `courseIds` limita a alguns cursos (ex.: os do aluno),
 * para não carregar o catálogo inteiro à toa.
 */
export async function listCoursesWithCurriculum(options: {
  includeDrafts: boolean;
  courseIds?: string[];
}): Promise<CourseCurriculum[]> {
  const courses = await prisma.course.findMany({
    where: {
      ...(options.includeDrafts ? {} : { isPublished: true }),
      ...(options.courseIds ? { id: { in: options.courseIds } } : {}),
    },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    include: curriculumInclude,
  });
  return courses.map(toCurriculum);
}

export type CourseSummary = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  isPublished: boolean;
  moduleCount: number;
  lessonCount: number;
  totalDurationSeconds: number;
};

/**
 * Resumo dos cursos para a vitrine (/cursos): só os números de cada cartão.
 *
 * Por que uma consulta própria: a vitrine não precisa das aulas (nem das descrições); contar e
 * somar no banco é bem mais leve do que trazer todas as aulas de todos os cursos.
 * (Paralelo em SQL/pandas: é um COUNT/SUM com GROUP BY em vez de trazer todas as linhas.)
 *
 * Passos:
 *  1. Cursos (publicados, ou todos para professor/admin) com a contagem de aulas e módulos visíveis.
 *  2. Soma das durações por curso (GROUP BY course_id).
 *  3. Junta tudo num formato simples.
 */
export async function listCatalogSummaries(options: { includeDrafts: boolean }): Promise<CourseSummary[]> {
  // Aulas que contam: publicadas (ou todas, para professor/admin) — mesma regra de `visibleCurriculum`.
  const visibleLessons = options.includeDrafts ? {} : { isPublished: true };
  const courses = await prisma.course.findMany({
    where: options.includeDrafts ? {} : { isPublished: true },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      isPublished: true,
      _count: {
        select: {
          lessons: { where: visibleLessons },
          // Aluno: só módulos com alguma aula publicada. Professor/admin: todos.
          modules: options.includeDrafts ? true : { where: { lessons: { some: visibleLessons } } },
        },
      },
    },
  });

  const durations = await prisma.lesson.groupBy({
    by: ["courseId"],
    where: { courseId: { in: courses.map((course) => course.id) }, ...visibleLessons },
    _sum: { durationSeconds: true },
  });
  const durationByCourse = new Map(durations.map((row) => [row.courseId, row._sum.durationSeconds ?? 0]));

  return courses.map((course) => ({
    id: course.id,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    isPublished: course.isPublished,
    moduleCount: course._count.modules,
    lessonCount: course._count.lessons,
    totalDurationSeconds: durationByCourse.get(course.id) ?? 0,
  }));
}

/** Os dados de vídeo de uma aula (usados só no servidor, depois de checar o acesso). */
export async function getLessonVideo(lessonId: string) {
  return prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { videoProvider: true, videoId: true, videoEmbedUrl: true },
  });
}
