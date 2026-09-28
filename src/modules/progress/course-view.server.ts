/**
 * course-view.server.ts — Busca no banco o necessário para `buildCourseView`.
 *
 * Quem chama: página do curso, página da aula e área do aluno.
 * O que devolve: `CourseView` (ver `course-view.ts`), ou `null` se o curso não existe ou a
 * pessoa não pode vê-lo (rascunho para quem não é professor/admin).
 */
import "server-only";

import { getCourseCurriculum, listCoursesWithCurriculum } from "@/modules/catalog/catalog.server";
import { canViewCourse, isEnrollmentActive } from "@/modules/enrollment/access";
import { getEnrollment, listEnrollments } from "@/modules/enrollment/enrollment.server";
import { hasMinimumRole } from "@/modules/auth/roles";

import { buildCourseView, type CourseView } from "./course-view";
import { listCourseProgress, listProgressForUser } from "./progress.server";

// Quem está vendo: `null` para visitante sem login.
export type ViewerRef = { userId: string; role: unknown } | null;

/**
 * A visão de UM curso para quem está vendo (página do curso e página da aula).
 *
 * Passos:
 *  1. Busca a grade do curso; se não existe ou é rascunho para quem não é professor/admin → null
 *     (a página responde "não encontrada").
 *  2. Visitante sem login: sem matrícula e sem progresso. Com login: busca matrícula e progresso
 *     AO MESMO TEMPO (`Promise.all`, como um `asyncio.gather`), pois uma não depende da outra.
 *  3. Entrega tudo para `buildCourseView`, que aplica as regras.
 */
export async function getCourseView(slug: string, viewer: ViewerRef, now: Date = new Date()): Promise<CourseView | null> {
  const curriculum = await getCourseCurriculum(slug);
  if (!curriculum || !canViewCourse(viewer?.role, curriculum.isPublished)) {
    return null;
  }

  // Visitante sem login: sem matrícula e sem progresso. Com login: busca os dois em paralelo.
  const [enrollment, progress] = viewer
    ? await Promise.all([getEnrollment(viewer.userId, curriculum.id), listCourseProgress(viewer.userId, curriculum.id)])
    : [null, []];

  return buildCourseView({ curriculum, role: viewer?.role, enrollment, progress, now });
}

/**
 * "Meus cursos" da área do aluno: cursos com matrícula ativa.
 * Professor/admin vê todos (inclusive rascunhos), já que tem acesso a todos.
 */
export async function listMyCourseViews(viewer: NonNullable<ViewerRef>, now: Date = new Date()): Promise<CourseView[]> {
  const isStaff = hasMinimumRole(viewer.role, "TEACHER");
  const [courses, enrollments, progress] = await Promise.all([
    listCoursesWithCurriculum({ includeDrafts: isStaff }),
    listEnrollments(viewer.userId),
    listProgressForUser(viewer.userId),
  ]);

  const enrollmentByCourse = new Map(enrollments.map((enrollment) => [enrollment.courseId, enrollment]));
  const myCourses = isStaff
    ? courses
    : courses.filter((course) => isEnrollmentActive(enrollmentByCourse.get(course.id) ?? null, now));

  return myCourses.map((curriculum) =>
    buildCourseView({
      curriculum,
      role: viewer.role,
      enrollment: enrollmentByCourse.get(curriculum.id) ?? null,
      progress,
      now,
    }),
  );
}
