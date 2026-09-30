/**
 * actions.ts — Server Actions das páginas de edital no painel (PROFESSOR ou mais: é conteúdo).
 *
 * Quem chama: os formulários de `components/` (/admin/conteudo/concursos...).
 * Toda ação: 1. confere login + perfil (`getSessionWithRole`); 2. valida (zod); 3. grava
 * (`notices-admin.server.ts`); 4. atualiza as telas.
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { errorState, formDataToObject, formDataWithLists, invalidState, stateFromError, successState, type FormState } from "@/lib/form-state";
import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "@/modules/auth/action-guards";

import { deleteNotice, saveNotice, setNoticePublished } from "./notices-admin.server";
import { noticeIdSchema, noticeSchema } from "./schemas";

function refreshScreens() {
  revalidatePath("/", "layout");
}

export async function saveNoticeAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("TEACHER"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = noticeSchema.safeParse(formDataWithLists(formData, ["subjectIds"]));
  if (!parsed.success) return invalidState(parsed.error);
  let id: string;
  try {
    ({ id } = await saveNotice(parsed.data));
  } catch (error) {
    return stateFromError(error, "salvar a página do concurso");
  }
  refreshScreens();
  if (!parsed.data.noticeId) redirect(`/admin/conteudo/concursos/${id}`);
  return successState("Página salva.");
}

export async function setNoticePublishedAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("TEACHER"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = noticeIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Página inválida.");
  try {
    await setNoticePublished(parsed.data.noticeId, formData.get("isPublished") === "true");
  } catch (error) {
    return stateFromError(error, "publicar a página");
  }
  refreshScreens();
  return successState("Página atualizada.");
}

export async function deleteNoticeAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("TEACHER"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = noticeIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Página inválida.");
  try {
    await deleteNotice(parsed.data.noticeId);
  } catch (error) {
    return stateFromError(error, "apagar a página");
  }
  refreshScreens();
  redirect("/admin/conteudo/concursos");
}
