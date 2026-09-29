/**
 * course-view.ts — Monta "o curso do ponto de vista de uma pessoa": o que ela vê, o que pode
 * assistir, o que já concluiu e por onde continuar.
 *
 * Quem chama: `course-view.server.ts` (que busca os dados no banco) — usado pela página do curso,
 * pela página da aula e pela área do aluno.
 *
 * Função "pura" (sem banco): junta as regras de catálogo (`visibleCurriculum`), de acesso
 * (`checkLessonAccess`) e de progresso (`rules.ts`). Testada em `course-view.test.ts`.
 */
import {
  flattenLessons,
  visibleCurriculum,
  type CourseCurriculum,
  type CurriculumLesson,
  type LessonState,
} from "@/modules/catalog/curriculum";
import { hasMinimumRole } from "@/modules/auth/roles";
import {
  checkLessonAccess,
  getEnrollmentStatus,
  type EnrollmentSnapshot,
  type EnrollmentStatus,
  type LessonAccess,
} from "@/modules/enrollment/access";

import { calculateCourseProgress, pickResumeLessonId, type CourseProgressSummary } from "./rules";

export type ProgressSnapshot = {
  lessonId: string;
  positionSeconds: number;
  durationSeconds: number | null;
  completedAt: Date | null;
  lastWatchedAt: Date;
};

export type CourseView = {
  curriculum: CourseCurriculum; // já sem o que a pessoa não deve ver
  orderedLessons: CurriculumLesson[];
  isStaff: boolean;
  hasCourseAccess: boolean; // professor/admin ou matrícula ativa
  enrollment: EnrollmentSnapshot | null;
  enrollmentStatus: EnrollmentStatus; // para explicar ao aluno (ex.: acesso vencido)
  accessByLesson: Record<string, LessonAccess>;
  lessonStates: Record<string, LessonState>;
  progressByLesson: Map<string, ProgressSnapshot>;
  summary: CourseProgressSummary;
  hasStarted: boolean;
  resumeLesson: CurriculumLesson | null;
  firstFreeLesson: CurriculumLesson | null;
};

/**
 * Junta grade + matrícula + progresso numa "visão" pronta para as telas.
 *
 * Por que uma função só: página do curso, página da aula e área do aluno precisam das MESMAS
 * respostas (o que ver, o que está liberado, o que foi concluído, por onde continuar). Calcular
 * em um lugar só evita que as telas discordem entre si.
 *
 * Passos: 1) filtra rascunhos; 2) separa o progresso das aulas deste curso; 3) decide o acesso
 * de cada aula; 4) calcula resumo, "continuar", primeira aula grátis e a situação da matrícula.
 */
export function buildCourseView(params: {
  curriculum: CourseCurriculum; // grade completa, com rascunhos
  role: unknown; // undefined = visitante sem login
  enrollment: EnrollmentSnapshot | null;
  progress: ProgressSnapshot[];
  now: Date;
}): CourseView {
  // 1. O que a pessoa pode ver da grade.
  const isStaff = hasMinimumRole(params.role, "TEACHER");
  const curriculum = visibleCurriculum(params.curriculum, { includeDrafts: isStaff });
  const orderedLessons = flattenLessons(curriculum);

  // 2. Progresso só das aulas deste curso. (Um `Set` responde "está na lista?" na hora,
  //    como um `set` do Python — melhor do que procurar numa lista item por item.)
  const lessonIds = orderedLessons.map((lesson) => lesson.id);
  const lessonIdSet = new Set(lessonIds);
  const progressByLesson = new Map(
    params.progress.filter((row) => lessonIdSet.has(row.lessonId)).map((row) => [row.lessonId, row]),
  );

  // 3. Acesso e estado de cada aula (✓ / 🔒 / ▶).
  const accessByLesson: Record<string, LessonAccess> = {};
  const lessonStates: Record<string, LessonState> = {};
  for (const lesson of orderedLessons) {
    const access = checkLessonAccess({
      role: params.role,
      isCoursePublished: params.curriculum.isPublished,
      isLessonPublished: lesson.isPublished,
      isFreePreview: lesson.isFreePreview,
      enrollment: params.enrollment,
      now: params.now,
    });
    accessByLesson[lesson.id] = access;
    lessonStates[lesson.id] = {
      accessible: access.allowed,
      completed: Boolean(progressByLesson.get(lesson.id)?.completedAt),
    };
  }

  // 4. Resumo, "continuar" e primeira aula grátis.
  const completedIds = new Set(
    [...progressByLesson.values()].filter((row) => row.completedAt).map((row) => row.lessonId),
  );
  const resumeLessonId = pickResumeLessonId(
    lessonIds,
    [...progressByLesson.values()].map((row) => ({
      lessonId: row.lessonId,
      completed: Boolean(row.completedAt),
      lastWatchedAt: row.lastWatchedAt,
    })),
  );

  const enrollmentStatus = getEnrollmentStatus(params.enrollment, params.now);

  return {
    curriculum,
    orderedLessons,
    isStaff,
    hasCourseAccess: isStaff || enrollmentStatus === "ACTIVE",
    enrollment: params.enrollment,
    enrollmentStatus,
    accessByLesson,
    lessonStates,
    progressByLesson,
    summary: calculateCourseProgress(lessonIds, completedIds),
    hasStarted: progressByLesson.size > 0,
    resumeLesson: orderedLessons.find((lesson) => lesson.id === resumeLessonId) ?? null,
    firstFreeLesson: orderedLessons.find((lesson) => lesson.isFreePreview) ?? null,
  };
}
