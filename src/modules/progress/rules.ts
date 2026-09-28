/**
 * rules.ts — Regras do progresso do aluno: quando a aula conta como concluída, quanto do curso
 * já foi feito e por onde continuar.
 *
 * Quem chama: `progress.server.ts` (ao salvar), a página da aula e a área do aluno.
 * Arquivo "puro" (sem banco), testado em `rules.test.ts`.
 */

// A aula conta como concluída quando o aluno chega a 90% do vídeo (ninguém assiste os créditos).
export const COMPLETION_THRESHOLD = 0.9;

// Abaixo disto, não vale a pena "retomar": começa do zero.
const MIN_RESUME_SECONDS = 5;
// Perto do fim, retomar também não ajuda: recomeça.
const END_MARGIN_SECONDS = 10;

/**
 * O que o player informou deve marcar a aula como concluída?
 * Sim se o vídeo terminou (`ended`) ou se a posição passou de 90% da duração.
 * Obs.: olha a POSIÇÃO no vídeo (não o tempo realmente assistido): pular para o fim também conclui.
 */
export function shouldMarkCompleted(params: {
  positionSeconds: number;
  durationSeconds: number | null;
  ended: boolean;
}): boolean {
  if (params.ended) return true;
  if (!params.durationSeconds || params.durationSeconds <= 0) return false;
  return params.positionSeconds / params.durationSeconds >= COMPLETION_THRESHOLD;
}

/**
 * Em que segundo o player deve começar ao abrir a aula ("continuar de onde parou").
 * Devolve 0 (começo) se a aula já foi concluída, se parou nos primeiros segundos ou quase no fim.
 */
export function getResumePosition(params: {
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
}): number {
  if (params.completed) return 0;
  if (params.positionSeconds < MIN_RESUME_SECONDS) return 0;
  if (params.durationSeconds && params.positionSeconds > params.durationSeconds - END_MARGIN_SECONDS) {
    return 0;
  }
  return Math.floor(params.positionSeconds);
}

export type CourseProgressSummary = {
  completed: number;
  total: number;
  percent: number; // 0 a 100, inteiro
};

/** Quantas aulas do curso já foram concluídas, e o percentual (arredondado para baixo). */
export function calculateCourseProgress(
  lessonIds: string[],
  completedLessonIds: Set<string>,
): CourseProgressSummary {
  const total = lessonIds.length;
  const completed = lessonIds.filter((id) => completedLessonIds.has(id)).length;
  const percent = total === 0 ? 0 : Math.floor((completed / total) * 100);
  return { completed, total, percent };
}

export type ProgressEntry = {
  lessonId: string;
  completed: boolean;
  lastWatchedAt: Date;
};

/**
 * Qual aula abrir no botão "Continuar"?
 *
 * Passos:
 *  1. Sem nenhum progresso: a primeira aula do curso.
 *  2. Pega a aula assistida mais recentemente. Se ela não foi concluída: volta nela.
 *  3. Se foi concluída: a próxima aula (na ordem do curso) ainda não concluída depois dela;
 *     se não houver depois, a primeira não concluída do curso; se tudo foi concluído, a última assistida.
 *
 * `orderedLessonIds` precisa estar na ordem do curso (módulo 1 aula 1, módulo 1 aula 2, ...).
 */
export function pickResumeLessonId(orderedLessonIds: string[], progress: ProgressEntry[]): string | null {
  if (orderedLessonIds.length === 0) return null;

  // Só considera progresso de aulas que ainda existem no curso.
  const known = progress.filter((entry) => orderedLessonIds.includes(entry.lessonId));
  if (known.length === 0) return orderedLessonIds[0];

  const mostRecent = known.reduce((latest, entry) =>
    entry.lastWatchedAt > latest.lastWatchedAt ? entry : latest,
  );
  if (!mostRecent.completed) return mostRecent.lessonId;

  const completedIds = new Set(known.filter((entry) => entry.completed).map((entry) => entry.lessonId));
  const startIndex = orderedLessonIds.indexOf(mostRecent.lessonId) + 1;
  const nextAfter = orderedLessonIds.slice(startIndex).find((id) => !completedIds.has(id));
  if (nextAfter) return nextAfter;

  const firstPending = orderedLessonIds.find((id) => !completedIds.has(id));
  return firstPending ?? mostRecent.lessonId;
}
