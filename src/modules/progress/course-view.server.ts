/**
 * course-view.server.ts — Busca no banco o necessário para `buildCourseView`.
 *
 * Quem chama: página do curso, página da aula e área do aluno.
 * O que devolve: `CourseView` (ver `course-view.ts`), ou `null` se o curso não existe ou a
 * pessoa não pode vê-lo (rascunho para quem não é professor/admin).
 */
import "server-only";

import { getCourseCurriculum, listCoursesWithCurriculum } from "@/modules/catalog/catalog.server";
import { canViewCourse } from "@/modules/enrollment/access";
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
 * "Meus cursos" da área do aluno: os cursos em que a pessoa tem (ou já teve) matrícula.
 * Matrícula vencida/cancelada também aparece — com o motivo e o progresso guardado —, para o
 * ex-aluno não achar que "nunca foi matriculado". Professor/admin vê todos (inclusive rascunhos).
 *
 * Passos:
 *  1. Busca as matrículas e o progresso da pessoa (em paralelo).
 *  2. Busca SÓ os cursos dessas matrículas (professor/admin: todos).
 *  3. Monta a visão de cada curso; os com acesso ativo vêm primeiro.
 */
export async function listMyCourseViews(viewer: NonNullable<ViewerRef>, now: Date = new Date()): Promise<CourseView[]> {
  const isStaff = hasMinimumRole(viewer.role, "TEACHER");
  const [enrollments, progress] = await Promise.all([
    listEnrollments(viewer.userId),
    listProgressForUser(viewer.userId),
  ]);
  if (!isStaff && enrollments.length === 0) {
    return [];
  }

  const courses = await listCoursesWithCurriculum({
    includeDrafts: isStaff,
    courseIds: isStaff ? undefined : enrollments.map((enrollment) => enrollment.courseId),
  });
  const enrollmentByCourse = new Map(enrollments.map((enrollment) => [enrollment.courseId, enrollment]));

  const views = courses.map((curriculum) =>
    buildCourseView({
      curriculum,
      role: viewer.role,
      enrollment: enrollmentByCourse.get(curriculum.id) ?? null,
      progress,
      now,
    }),
  );
  // `sort` estável: mantém a ordem do catálogo dentro de cada grupo (ativos primeiro).
  return views.sort((a, b) => Number(b.hasCourseAccess) - Number(a.hasCourseAccess));
}
