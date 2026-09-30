/**
 * lesson-subjects.server.ts — A ligação aula ↔ assunto (Fase 8), do lado de quem estuda.
 *
 * Quem chama:
 *  - "Resolver questões" e "Meu desempenho": "estude esta aula" para o assunto da questão/ponto fraco
 *    (`listStudyLessonsBySubject`);
 *  - a página da aula: "treinar questões deste assunto" (`listLessonSubjects`).
 * Quem GRAVA a ligação é o painel (`setLessonSubjects`, em `admin/catalog-admin.server.ts`).
 *
 * O link leva à página da aula, que decide o acesso como sempre (`checkLessonAccess`): quem não tem o
 * curso vê o motivo e a oferta. Aqui só não listamos aulas em rascunho (aula ou curso não publicados).
 */
import "server-only";

import { prisma } from "@/lib/db";

export type StudyLesson = { id: string; title: string; courseTitle: string; href: string };

/**
 * Até `perSubject` aulas de cada assunto, na ordem do catálogo (curso → módulo → aula).
 * Devolve um mapa assunto → aulas (assunto sem aula não aparece no mapa).
 * Paralelo em Python: um `groupby` depois de um `sort_values`, pegando o `head(perSubject)` de cada grupo.
 */
export async function listStudyLessonsBySubject(
  subjectIds: string[],
  options: { includeDrafts?: boolean; perSubject?: number } = {},
): Promise<Map<string, StudyLesson[]>> {
  const result = new Map<string, StudyLesson[]>();
  if (subjectIds.length === 0) return result;
  const rows = await prisma.lessonSubject.findMany({
    where: {
      subjectId: { in: subjectIds },
      ...(options.includeDrafts ? {} : { lesson: { isPublished: true, course: { isPublished: true } } }),
    },
    select: {
      subjectId: true,
      lesson: {
        select: {
          id: true,
          slug: true,
          title: true,
          position: true,
          module: { select: { position: true } },
          course: { select: { slug: true, title: true, position: true } },
        },
      },
    },
  });
  // Ordem do catálogo: posição do curso, depois do módulo, depois da aula.
  rows.sort(
    (a, b) =>
      a.lesson.course.position - b.lesson.course.position ||
      a.lesson.course.title.localeCompare(b.lesson.course.title) ||
      a.lesson.module.position - b.lesson.module.position ||
      a.lesson.position - b.lesson.position,
  );
  const limit = options.perSubject ?? 2;
  for (const { subjectId, lesson } of rows) {
    const list = result.get(subjectId) ?? [];
    if (list.length >= limit) continue;
    list.push({ id: lesson.id, title: lesson.title, courseTitle: lesson.course.title, href: `/cursos/${lesson.course.slug}/aulas/${lesson.slug}` });
    result.set(subjectId, list);
  }
  return result;
}

/** Os assuntos que uma aula ensina (para o "treinar questões" da página da aula). */
export async function listLessonSubjects(lessonId: string): Promise<Array<{ id: string; name: string; slug: string }>> {
  const rows = await prisma.lessonSubject.findMany({
    where: { lessonId },
    select: { subject: { select: { id: true, name: true, slug: true, position: true } } },
  });
  return rows.map((row) => row.subject).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}
