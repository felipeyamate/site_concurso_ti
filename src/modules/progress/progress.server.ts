/**
 * progress.server.ts — Grava e lê o progresso do aluno nas aulas (tabela lesson_progress).
 *
 * Quem chama: as ações `actions.ts` (depois de checar login e acesso), a página da aula e a
 * área do aluno.
 * Regra importante: depois de concluída, a aula continua concluída mesmo que o aluno volte e
 * assista de novo do começo (só o botão "Desmarcar" tira a conclusão).
 */
import "server-only";

import { prisma } from "@/lib/db";

import type { ProgressSnapshot } from "./course-view";
import { shouldMarkCompleted } from "./rules";

// O formato do progresso é definido UMA vez, em `course-view.ts` (as regras usam o mesmo tipo).
export type LessonProgressRow = ProgressSnapshot;

const progressSelect = {
  lessonId: true,
  positionSeconds: true,
  durationSeconds: true,
  completedAt: true,
  lastWatchedAt: true,
} as const;

/**
 * Salva onde o aluno está no vídeo e marca como concluída quando chega perto do fim.
 *
 * Passos:
 *  1. Decide se esta atualização conclui a aula (regra em `rules.ts`).
 *  2. Busca o registro atual para saber se a aula já estava concluída.
 *  3. Cria ou atualiza o registro (upsert: um por aluno e aula). Uma atualização comum NUNCA
 *     apaga a conclusão: só grava `completedAt` quando conclui agora. Assim, dois salvamentos
 *     ao mesmo tempo (ex.: duas abas) não desfazem a conclusão um do outro.
 */
export async function recordLessonProgress(params: {
  userId: string;
  lessonId: string;
  positionSeconds: number;
  durationSeconds: number | null;
  ended: boolean;
  completeByPosition?: boolean; // ver `shouldMarkCompleted`
  now?: Date;
}): Promise<{ completed: boolean }> {
  const now = params.now ?? new Date();
  const reachedEnd = shouldMarkCompleted(params);

  const existing = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: params.userId, lessonId: params.lessonId } },
    select: { completedAt: true },
  });
  const alreadyCompleted = Boolean(existing?.completedAt);
  const completesNow = reachedEnd && !alreadyCompleted;

  const position = {
    positionSeconds: Math.floor(params.positionSeconds),
    durationSeconds: params.durationSeconds === null ? null : Math.floor(params.durationSeconds),
    lastWatchedAt: now,
  };
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: params.userId, lessonId: params.lessonId } },
    create: {
      userId: params.userId,
      lessonId: params.lessonId,
      ...position,
      completedAt: reachedEnd ? now : null,
    },
    // Na atualização, `completedAt` só entra quando a aula conclui agora (nunca volta a vazio aqui).
    update: completesNow ? { ...position, completedAt: now } : position,
  });
  return { completed: alreadyCompleted || reachedEnd };
}

/** Botão "Marcar como concluída" / "Desmarcar". */
export async function setLessonCompletion(params: {
  userId: string;
  lessonId: string;
  completed: boolean;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  const completedAt = params.completed ? now : null;
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: params.userId, lessonId: params.lessonId } },
    create: { userId: params.userId, lessonId: params.lessonId, completedAt, lastWatchedAt: now },
    update: { completedAt, lastWatchedAt: now },
  });
}

/** Progresso do aluno em todas as aulas de um curso. */
export async function listCourseProgress(userId: string, courseId: string): Promise<LessonProgressRow[]> {
  return prisma.lessonProgress.findMany({
    where: { userId, lesson: { courseId } },
    select: progressSelect,
  });
}

/** Progresso do aluno em várias aulas de uma vez (área do aluno: todos os cursos). */
export async function listProgressForUser(userId: string): Promise<LessonProgressRow[]> {
  return prisma.lessonProgress.findMany({ where: { userId }, select: progressSelect });
}
