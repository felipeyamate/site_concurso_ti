/**
 * actions.ts — Server Actions do painel do banco de questões (PROFESSOR ou mais).
 *
 * Quem chama: os formulários de `components/` (páginas /admin/questoes/...).
 * O que devolve: um `FormState` (mensagem + erros por campo), um resultado de importação, ou
 * redireciona para outra página.
 *
 * Toda ação: 1. confere login + perfil PROFESSOR (`getSessionWithRole` — uma ação pode ser
 * chamada direto por HTTP); 2. valida (zod); 3. grava (`questions-admin.server.ts`);
 * 4. atualiza as telas (questões, simulados e o mapa "o que mais cai" mudam juntos).
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { errorState, formDataToObject, invalidState, stateFromError, successState, type FormState } from "@/lib/form-state";
import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "@/modules/auth/action-guards";

import type { ImportError } from "../import-questions";
import { boardSchema, deleteByIdSchema, examSchema, questionSchema, subjectSchema } from "../schemas";
import {
  deleteBoard,
  deleteExam,
  deleteQuestion,
  deleteSubject,
  importQuestionsFromCsv,
  saveBoard,
  saveExam,
  saveQuestion,
  saveSubject,
  setQuestionPublished,
} from "./questions-admin.server";

// Um CSV de 500 questões fica bem abaixo disso; acima, é outro tipo de arquivo.
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

function refreshQuestionScreens() {
  revalidatePath("/", "layout");
}

async function teacher() {
  return getSessionWithRole("TEACHER");
}

// ---------------------------------------------------------------------------------------------
// Classificação
// ---------------------------------------------------------------------------------------------

export async function saveBoardAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await teacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = boardSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await saveBoard(parsed.data);
  } catch (error) {
    return stateFromError(error, "salvar a banca");
  }
  refreshQuestionScreens();
  return successState("Banca salva.");
}

export async function deleteBoardAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await teacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = deleteByIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Banca inválida.");
  try {
    await deleteBoard(parsed.data.id);
  } catch (error) {
    return stateFromError(error, "apagar a banca");
  }
  refreshQuestionScreens();
  return successState("Banca apagada.");
}

export async function saveSubjectAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await teacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = subjectSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await saveSubject(parsed.data);
  } catch (error) {
    return stateFromError(error, "salvar o assunto");
  }
  refreshQuestionScreens();
  return successState("Assunto salvo.");
}

export async function deleteSubjectAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await teacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = deleteByIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Assunto inválido.");
  try {
    await deleteSubject(parsed.data.id);
  } catch (error) {
    return stateFromError(error, "apagar o assunto");
  }
  refreshQuestionScreens();
  return successState("Assunto apagado.");
}

export async function saveExamAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await teacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = examSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await saveExam(parsed.data);
  } catch (error) {
    return stateFromError(error, "salvar a prova");
  }
  refreshQuestionScreens();
  return successState("Prova salva.");
}

export async function deleteExamAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await teacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = deleteByIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Prova inválida.");
  try {
    await deleteExam(parsed.data.id);
  } catch (error) {
    return stateFromError(error, "apagar a prova");
  }
  refreshQuestionScreens();
  return successState("Prova apagada.");
}

// ---------------------------------------------------------------------------------------------
// Questões
// ---------------------------------------------------------------------------------------------

export async function saveQuestionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await teacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = questionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  let id: string;
  try {
    ({ id } = await saveQuestion(parsed.data));
  } catch (error) {
    return stateFromError(error, "salvar a questão");
  }
  refreshQuestionScreens();
  if (parsed.data.questionId) return successState(parsed.data.isPublished ? "Questão salva e publicada." : "Questão salva (rascunho).");
  // Questão nova: vai para a página dela (fora do try: `redirect` funciona lançando um "erro").
  redirect(`/admin/questoes/${id}`);
}

export async function setQuestionPublishedAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await teacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const values = formDataToObject(formData);
  const parsed = deleteByIdSchema.safeParse(values);
  if (!parsed.success) return errorState("Questão inválida.");
  const publish = values.publish === "true";
  try {
    await setQuestionPublished(parsed.data.id, publish);
  } catch (error) {
    return stateFromError(error, "publicar a questão");
  }
  refreshQuestionScreens();
  return successState(publish ? "Questão publicada." : "Questão despublicada.");
}

export async function deleteQuestionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await teacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = deleteByIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Questão inválida.");
  try {
    await deleteQuestion(parsed.data.id);
  } catch (error) {
    return stateFromError(error, "apagar a questão");
  }
  refreshQuestionScreens();
  redirect("/admin/questoes");
}

// ---------------------------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------------------------

export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string; errors: ImportError[] }
  | { status: "success"; message: string };

export async function importQuestionsAction(_previous: ImportState, formData: FormData): Promise<ImportState> {
  if (!(await teacher())) return { status: "error", message: PERMISSION_DENIED_MESSAGE, errors: [] };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Escolha o arquivo CSV da planilha.", errors: [] };
  if (file.size > MAX_IMPORT_BYTES) return { status: "error", message: "Arquivo grande demais (máximo 2 MB).", errors: [] };

  try {
    const outcome = await importQuestionsFromCsv(await file.text());
    if (!outcome.ok) {
      return { status: "error", message: "Nada foi importado. Corrija a planilha e envie de novo:", errors: outcome.errors };
    }
    refreshQuestionScreens();
    return {
      status: "success",
      message: `${outcome.created} ${outcome.created === 1 ? "questão importada" : "questões importadas"} como rascunho. Revise e publique na lista.`,
    };
  } catch (error) {
    console.error("[questoes] Falha na importação:", error);
    return { status: "error", message: "Não foi possível importar agora. Tente de novo.", errors: [] };
  }
}
