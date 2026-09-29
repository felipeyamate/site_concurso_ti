/**
 * actions.ts — Server Actions do progresso: chamadas pelo player e pelo botão de concluir.
 *
 * Quem chama: `components/lesson-player.tsx` e `components/completion-toggle.tsx` (no navegador).
 * O que devolve: `{ ok: true, completed }` ou `{ ok: false, error }`.
 *
 * Como qualquer pessoa pode chamar uma Server Action (é uma requisição HTTP por baixo), SEMPRE:
 *   1. validamos a entrada (zod);  2. conferimos o login;  3. conferimos o ACESSO à aula
 *   (matrícula/aula grátis). Sem isso, alguém gravaria progresso em aulas que não pode ver.
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/modules/auth/session";
import { getLessonAccessForUser } from "@/modules/enrollment/enrollment.server";

import { recordLessonProgress, setLessonCompletion } from "./progress.server";

type ActionResult = { ok: true; completed: boolean } | { ok: false; error: string };

const MAX_SECONDS = 24 * 60 * 60; // nenhuma aula tem mais de 24 horas

const progressInputSchema = z.object({
  lessonId: z.string().min(1).max(200),
  positionSeconds: z.number().min(0).max(MAX_SECONDS),
  durationSeconds: z.number().positive().max(MAX_SECONDS).nullable(),
  ended: z.boolean(),
  // `false` logo depois de "desmarcar": não concluir de novo só por estar depois dos 90%.
  completeByPosition: z.boolean().default(true),
});

const completionInputSchema = z.object({
  lessonId: z.string().min(1).max(200),
  completed: z.boolean(),
});

/**
 * Passos comuns às duas ações: login + acesso. Devolve os dados da aula ou uma mensagem de erro.
 */
type Authorization =
  | { ok: true; userId: string; lesson: { slug: string; courseSlug: string } }
  | { ok: false; error: string };

async function authorizeLesson(lessonId: string): Promise<Authorization> {
  const session = await getCurrentSession();
  if (!session) {
    return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  }
  const result = await getLessonAccessForUser({
    userId: session.user.id,
    role: session.user.role,
    lessonId,
  });
  if (!result || !result.access.allowed) {
    return { ok: false, error: "Você não tem acesso a esta aula." };
  }
  return { ok: true, userId: session.user.id, lesson: result.lesson };
}

/** O player chama isto a cada ~10 segundos, ao pausar e ao terminar o vídeo. */
export async function saveLessonProgressAction(input: unknown): Promise<ActionResult> {
  const parsed = progressInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados de progresso inválidos." };
  }
  const authorized = await authorizeLesson(parsed.data.lessonId);
  if (!authorized.ok) {
    return { ok: false, error: authorized.error };
  }

  // Posição nunca maior que a duração (o player às vezes informa alguns milissegundos a mais).
  const duration = parsed.data.durationSeconds;
  const position = duration === null ? parsed.data.positionSeconds : Math.min(parsed.data.positionSeconds, duration);

  const { completed } = await recordLessonProgress({
    userId: authorized.userId,
    lessonId: parsed.data.lessonId,
    positionSeconds: position,
    durationSeconds: duration,
    ended: parsed.data.ended,
    completeByPosition: parsed.data.completeByPosition,
  });
  return { ok: true, completed };
}

/** Botão "Marcar como concluída" / "Desmarcar". */
export async function setLessonCompletedAction(input: unknown): Promise<ActionResult> {
  const parsed = completionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }
  const authorized = await authorizeLesson(parsed.data.lessonId);
  if (!authorized.ok) {
    return { ok: false, error: authorized.error };
  }

  await setLessonCompletion({
    userId: authorized.userId,
    lessonId: parsed.data.lessonId,
    completed: parsed.data.completed,
  });

  // Atualiza as telas que mostram a conclusão (a própria aula, a página do curso e a área do aluno).
  revalidatePath(`/cursos/${authorized.lesson.courseSlug}/aulas/${authorized.lesson.slug}`);
  revalidatePath(`/cursos/${authorized.lesson.courseSlug}`);
  revalidatePath("/area-do-aluno");
  return { ok: true, completed: parsed.data.completed };
}
