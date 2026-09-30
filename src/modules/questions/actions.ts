/**
 * actions.ts — Server Actions do banco de questões para o ALUNO: responder, criar simulado,
 * salvar resposta do simulado e finalizar.
 *
 * Quem chama: os componentes de `components/` (cartão da questão, formulário e tela do simulado).
 *
 * Toda ação: 1. confere o LOGIN (no banco, de novo — a ação pode ser chamada direto por HTTP);
 * 2. valida o que chegou (zod); 3. chama as regras (`questions.server.ts`, `mock-exams.server.ts`),
 * que conferem o acesso de verdade (cota grátis, simulado só com acesso completo, dono do simulado).
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { UserFacingError, formDataToObject, formDataWithLists, invalidState, stateFromError, type FormState } from "@/lib/form-state";
import { getSessionWithRole } from "@/modules/auth/action-guards";

import { createMockExam, finishMockExam, getMockExamClock, saveMockExamAnswer } from "./mock-exams.server";
import { answerQuestion, type AnswerResult } from "./questions.server";
import { answerSchema, createMockExamSchema, mockExamIdSchema, saveMockAnswerSchema } from "./schemas";

const LOGIN_MESSAGE = "Sua sessão terminou. Entre de novo para continuar.";

/** Resultado de "Responder" (o cartão da questão mostra o gabarito e o comentário). */
export type AnswerState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | ({ status: "answered"; answer: string } & AnswerResult);

export async function answerQuestionAction(_previous: AnswerState, formData: FormData): Promise<AnswerState> {
  const session = await getSessionWithRole("STUDENT");
  if (!session) return { status: "error", message: LOGIN_MESSAGE };
  const parsed = answerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { status: "error", message: "Escolha uma alternativa antes de responder." };
  try {
    const result = await answerQuestion({
      viewer: { id: session.user.id, role: session.user.role },
      questionId: parsed.data.questionId,
      answer: parsed.data.answer,
    });
    return { status: "answered", answer: parsed.data.answer, ...result };
  } catch (error) {
    if (error instanceof UserFacingError) return { status: "error", message: error.message };
    console.error("[questoes] Falha ao responder:", error);
    return { status: "error", message: "Não foi possível registrar a resposta. Tente de novo." };
  }
}

export async function createMockExamAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionWithRole("STUDENT");
  if (!session) return { status: "error", message: LOGIN_MESSAGE, fieldErrors: {} };
  const parsed = createMockExamSchema.safeParse(formDataWithLists(formData, ["subjectIds"]));
  if (!parsed.success) return invalidState(parsed.error);

  let mockExamId: string;
  try {
    ({ mockExamId } = await createMockExam({ viewer: { id: session.user.id, role: session.user.role }, ...parsed.data }));
  } catch (error) {
    return stateFromError(error, "criar o simulado");
  }
  revalidatePath("/simulados");
  // `redirect` fora do try: ele funciona lançando um "erro" especial do Next.js.
  redirect(`/simulados/${mockExamId}`);
}

/** Salva uma resposta do simulado (chamada a cada clique numa alternativa). */
export async function saveMockAnswerAction(formData: FormData): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await getSessionWithRole("STUDENT");
  if (!session) return { ok: false, message: LOGIN_MESSAGE };
  const parsed = saveMockAnswerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, message: "Resposta inválida." };
  try {
    await saveMockExamAnswer({ viewer: { id: session.user.id, role: session.user.role }, ...parsed.data });
    return { ok: true };
  } catch (error) {
    if (error instanceof UserFacingError) return { ok: false, message: error.message };
    console.error("[simulados] Falha ao salvar resposta:", error);
    return { ok: false, message: "Não foi possível salvar a resposta. Tente de novo." };
  }
}

/**
 * O relógio do simulado medido agora no servidor (a tela pergunta ao abrir e ao voltar para a aba —
 * ver `getMockExamClock`). Só o dono; sem login ou de outra pessoa = null.
 */
export async function mockExamClockAction(mockExamId: string): Promise<{ remainingMs: number | null; finished: boolean } | null> {
  const session = await getSessionWithRole("STUDENT");
  if (!session) return null;
  const parsed = mockExamIdSchema.safeParse({ mockExamId });
  if (!parsed.success) return null;
  return getMockExamClock({ userId: session.user.id, mockExamId: parsed.data.mockExamId });
}

export async function finishMockExamAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionWithRole("STUDENT");
  if (!session) return { status: "error", message: LOGIN_MESSAGE, fieldErrors: {} };
  const parsed = mockExamIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await finishMockExam({ viewer: { id: session.user.id, role: session.user.role }, mockExamId: parsed.data.mockExamId });
  } catch (error) {
    return stateFromError(error, "finalizar o simulado");
  }
  revalidatePath("/simulados");
  revalidatePath("/area-do-aluno/desempenho");
  redirect(`/simulados/${parsed.data.mockExamId}`);
}
