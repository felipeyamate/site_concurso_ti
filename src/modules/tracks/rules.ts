/**
 * rules.ts — Regras puras das trilhas de estudo (Fase 8): o que cada pessoa vê numa trilha, o que
 * já fez, qual é o próximo passo, e o rascunho de trilha montado pelo "o que mais cai" da banca.
 *
 * Quem chama: `tracks.server.ts` (página pública da trilha) e `tracks-admin.server.ts` (montar pelo
 * "o que mais cai"). Arquivo "puro" (sem banco), testado em `rules.test.ts`.
 *
 * Regra que não muda: a trilha NÃO libera aula nenhuma. Cada aula continua decidida pela matrícula
 * no curso dela (`checkLessonAccess`, a mesma função das páginas do curso e da aula). A trilha só
 * diz O QUE estudar e EM QUE ORDEM.
 */
import { hasMinimumRole } from "@/modules/auth/roles";
import { checkLessonAccess, type EnrollmentSnapshot, type LessonAccess } from "@/modules/enrollment/access";

type Named = { id: string; name: string; slug: string };

export type TrackLesson = {
  id: string;
  slug: string;
  title: string;
  durationSeconds: number;
  isPublished: boolean;
  isFreePreview: boolean;
  course: { id: string; slug: string; title: string; isPublished: boolean };
};

export type TrackItemInput =
  | { id: string; kind: "LESSON"; note: string; lesson: TrackLesson }
  | { id: string; kind: "PRACTICE"; note: string; questionGoal: number; subject: Named; board: Named | null };

export type TrackSectionInput = {
  id: string;
  title: string;
  description: string;
  subject: Named | null;
  items: TrackItemInput[];
};

/** O que a pessoa já fez num assunto (e banca): questões DIFERENTES respondidas, respostas e acertos. */
export type PracticeStat = { subjectId: string; boardId: string | null; answered: number; attempts: number; correct: number };

export type TrackLessonItemView = {
  id: string;
  kind: "LESSON";
  note: string;
  lesson: TrackLesson;
  href: string;
  access: LessonAccess;
  // Rascunho (aula ou curso não publicados): só professor/admin vê, com um aviso.
  isDraft: boolean;
  done: boolean;
};

export type TrackPracticeItemView = {
  id: string;
  kind: "PRACTICE";
  note: string;
  subject: Named;
  board: Named | null;
  goal: number;
  answered: number;
  // Acerto nas respostas deste treino (null = ainda não respondeu nenhuma).
  accuracyPercent: number | null;
  href: string;
  done: boolean;
};

export type TrackItemView = TrackLessonItemView | TrackPracticeItemView;

export type TrackSectionView = {
  id: string;
  title: string;
  description: string;
  subject: Named | null;
  items: TrackItemView[];
  done: number;
  total: number;
};

export type TrackView = {
  sections: TrackSectionView[];
  summary: { done: number; total: number; percent: number };
  // O próximo passo: o primeiro ainda não feito que a pessoa CONSEGUE fazer (aula liberada ou treino);
  // se todos os que faltam estão bloqueados, o primeiro que falta. null = trilha concluída (ou sem passos).
  nextItemId: string | null;
};

/** Endereço da aula (o mesmo das páginas do catálogo). */
export function lessonHref(lesson: { slug: string; course: { slug: string } }): string {
  return `/cursos/${lesson.course.slug}/aulas/${lesson.slug}`;
}

/** "Resolver questões" já filtrado pelo assunto (e pela banca, se houver). */
export function practiceHref(subject: Pick<Named, "slug">, board: Pick<Named, "slug"> | null): string {
  return `/questoes?assunto=${encodeURIComponent(subject.slug)}${board ? `&banca=${encodeURIComponent(board.slug)}` : ""}`;
}

/**
 * Soma o que a pessoa fez no assunto do treino. Sem banca no treino, vale qualquer banca; com banca,
 * só as questões dela. (Cada questão tem UMA banca, então somar as linhas não conta uma questão duas vezes.)
 */
export function practiceProgress(stats: readonly PracticeStat[], subjectId: string, boardId: string | null) {
  let answered = 0;
  let attempts = 0;
  let correct = 0;
  for (const stat of stats) {
    if (stat.subjectId !== subjectId) continue;
    if (boardId !== null && stat.boardId !== boardId) continue;
    answered += stat.answered;
    attempts += stat.attempts;
    correct += stat.correct;
  }
  return { answered, accuracyPercent: attempts === 0 ? null : Math.round((correct / attempts) * 100) };
}

/**
 * Monta a trilha do ponto de vista de uma pessoa.
 *
 * Passos:
 *  1. Aula em rascunho (aula ou curso não publicados): só professor/admin vê (com aviso); para os
 *     outros, o passo some — como nas páginas do curso. Etapa sem nenhum passo visível some também.
 *  2. Aula: acesso pela MESMA regra das páginas do catálogo (`checkLessonAccess` com a matrícula no
 *     curso da aula); feita = concluída pelo aluno.
 *  3. Treino: feito quando a pessoa respondeu `questionGoal` questões DIFERENTES do assunto (e banca).
 *  4. Resumo (feitos/total, % para baixo, como nos cursos) e o próximo passo = o primeiro não feito que
 *     a pessoa consegue fazer (uma aula com cadeado não vira "Próximo passo" se há um treino liberado).
 * Visitante sem login: nada feito, e as aulas bloqueadas explicam o porquê (a página oferece o curso).
 */
export function buildTrackView(input: {
  sections: readonly TrackSectionInput[];
  role: unknown;
  enrollmentByCourse: ReadonlyMap<string, EnrollmentSnapshot | null>;
  completedLessonIds: ReadonlySet<string>;
  practiceStats: readonly PracticeStat[];
  now: Date;
}): TrackView {
  const isStaff = hasMinimumRole(input.role, "TEACHER");
  const sections: TrackSectionView[] = [];

  for (const section of input.sections) {
    const items: TrackItemView[] = [];
    for (const item of section.items) {
      if (item.kind === "LESSON") {
        const isDraft = !item.lesson.isPublished || !item.lesson.course.isPublished;
        if (isDraft && !isStaff) continue;
        const access = checkLessonAccess({
          role: input.role,
          isCoursePublished: item.lesson.course.isPublished,
          isLessonPublished: item.lesson.isPublished,
          isFreePreview: item.lesson.isFreePreview,
          enrollment: input.enrollmentByCourse.get(item.lesson.course.id) ?? null,
          now: input.now,
        });
        items.push({
          id: item.id,
          kind: "LESSON",
          note: item.note,
          lesson: item.lesson,
          href: lessonHref(item.lesson),
          access,
          isDraft,
          done: input.completedLessonIds.has(item.lesson.id),
        });
      } else {
        const progress = practiceProgress(input.practiceStats, item.subject.id, item.board?.id ?? null);
        items.push({
          id: item.id,
          kind: "PRACTICE",
          note: item.note,
          subject: item.subject,
          board: item.board,
          goal: item.questionGoal,
          answered: progress.answered,
          accuracyPercent: progress.accuracyPercent,
          href: practiceHref(item.subject, item.board),
          done: progress.answered >= item.questionGoal,
        });
      }
    }
    if (items.length === 0 && !isStaff) continue;
    sections.push({
      id: section.id,
      title: section.title,
      description: section.description,
      subject: section.subject,
      items,
      done: items.filter((item) => item.done).length,
      total: items.length,
    });
  }

  const allItems = sections.flatMap((section) => section.items);
  const done = allItems.filter((item) => item.done).length;
  const total = allItems.length;
  const pending = allItems.filter((item) => !item.done);
  const doable = pending.find((item) => item.kind === "PRACTICE" || item.access.allowed);
  return {
    sections,
    summary: { done, total, percent: total === 0 ? 0 : Math.floor((done / total) * 100) },
    nextItemId: (doable ?? pending[0])?.id ?? null,
  };
}

// =============================================================================================
// Rascunho pelo "o que mais cai"
// =============================================================================================

export const DEFAULT_QUESTION_GOAL = 10;

export type IncidenceEntry = { subjectId: string; name: string; count: number };

export type TrackDraftItem =
  | { kind: "LESSON"; lessonId: string }
  | { kind: "PRACTICE"; subjectId: string; boardId: string; questionGoal: number };

export type TrackDraftSection = { title: string; subjectId: string; items: TrackDraftItem[] };

/**
 * Monta as etapas de uma trilha na ordem do que MAIS CAI na banca (o diferencial do produto:
 * "o aluno estuda primeiro o que dá mais pontos").
 *
 * Passos, para cada assunto da banca (do que mais cai para o que menos cai):
 *  1. Uma etapa com o nome do assunto.
 *  2. As aulas que ensinam o assunto (na ordem do catálogo). Uma aula que já apareceu numa etapa
 *     anterior não se repete (uma aula de "Redes e Internet" pode ensinar dois assuntos).
 *  3. Um treino de questões do assunto NA BANCA, com a meta padrão.
 * O professor revisa depois: reordena, tira e acrescenta passos no painel.
 * Paralelo em Python: um `for` sobre `df.sort_values("count", ascending=False)` montando listas.
 */
export function buildTrackDraft(input: {
  incidence: readonly IncidenceEntry[];
  lessonIdsBySubject: ReadonlyMap<string, readonly string[]>;
  boardId: string;
  questionGoal?: number;
}): TrackDraftSection[] {
  const goal = input.questionGoal ?? DEFAULT_QUESTION_GOAL;
  const ordered = [...input.incidence].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  const used = new Set<string>();
  return ordered.map((subject) => {
    const lessonIds = (input.lessonIdsBySubject.get(subject.subjectId) ?? []).filter((lessonId) => !used.has(lessonId));
    for (const lessonId of lessonIds) used.add(lessonId);
    return {
      title: subject.name,
      subjectId: subject.subjectId,
      items: [
        ...lessonIds.map((lessonId): TrackDraftItem => ({ kind: "LESSON", lessonId })),
        { kind: "PRACTICE", subjectId: subject.subjectId, boardId: input.boardId, questionGoal: goal },
      ],
    };
  });
}
