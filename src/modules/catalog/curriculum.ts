/**
 * curriculum.ts — Tipos e regras da "grade" do curso: módulos, aulas, ordem e navegação.
 *
 * Quem chama: as páginas do curso e da aula, e a área do aluno.
 * Arquivo "puro" (sem banco), testado em `curriculum.test.ts`. As consultas ficam em
 * `catalog.server.ts`, que devolve os dados já neste formato.
 */

export type CurriculumLesson = {
  id: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  durationSeconds: number;
  isFreePreview: boolean;
  isPublished: boolean;
};

export type CurriculumModule = {
  id: string;
  title: string;
  position: number;
  lessons: CurriculumLesson[];
};

// Como uma aula aparece para uma pessoa: já concluída? pode assistir?
export type LessonState = {
  completed: boolean;
  accessible: boolean;
};

export type CourseCurriculum = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  isPublished: boolean;
  modules: CurriculumModule[];
};

/**
 * Tira da grade o que a pessoa não deve ver: aulas não publicadas (e módulos que ficarem vazios).
 * Professores/admin passam `includeDrafts: true` para revisar rascunhos.
 */
export function visibleCurriculum(curriculum: CourseCurriculum, options: { includeDrafts: boolean }): CourseCurriculum {
  if (options.includeDrafts) return curriculum;
  const modules = curriculum.modules
    .map((courseModule) => ({
      ...courseModule,
      lessons: courseModule.lessons.filter((lesson) => lesson.isPublished),
    }))
    .filter((courseModule) => courseModule.lessons.length > 0);
  return { ...curriculum, modules };
}

/**
 * Lista todas as aulas numa fila só, na ordem do curso: módulo 1 (aula 1, 2...), módulo 2...
 * (Como um `[lesson for module in modules for lesson in module.lessons]` do Python, ordenado.)
 */
export function flattenLessons(curriculum: CourseCurriculum): CurriculumLesson[] {
  return [...curriculum.modules]
    .sort((a, b) => a.position - b.position)
    .flatMap((courseModule) => [...courseModule.lessons].sort((a, b) => a.position - b.position));
}

/** Aula anterior e próxima, para os botões de navegação da página da aula. */
export function findAdjacentLessons(
  orderedLessons: CurriculumLesson[],
  lessonId: string,
): { previous: CurriculumLesson | null; next: CurriculumLesson | null } {
  const index = orderedLessons.findIndex((lesson) => lesson.id === lessonId);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: orderedLessons[index - 1] ?? null,
    next: orderedLessons[index + 1] ?? null,
  };
}

/** Soma das durações (em segundos). */
export function totalDurationSeconds(lessons: CurriculumLesson[]): number {
  return lessons.reduce((sum, lesson) => sum + lesson.durationSeconds, 0);
}
