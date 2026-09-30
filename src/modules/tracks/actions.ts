/**
 * actions.ts — Server Actions das trilhas no painel (PROFESSOR ou mais: é conteúdo).
 *
 * Quem chama: os formulários e botões de `components/` (/admin/conteudo/trilhas...).
 * Toda ação: 1. confere login + perfil (`getSessionWithRole` — uma Server Action pode ser chamada
 * direto por HTTP); 2. valida (zod); 3. grava (`tracks-admin.server.ts`); 4. atualiza as telas.
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { errorState, formDataToObject, invalidState, stateFromError, successState, type FormState } from "@/lib/form-state";
import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "@/modules/auth/action-guards";

import {
  lessonItemSchema,
  moveSchema,
  practiceItemSchema,
  sectionIdSchema,
  sectionSchema,
  itemIdSchema,
  trackIdSchema,
  trackSchema,
  updateItemSchema,
} from "./schemas";
import {
  addLessonItem,
  addPracticeItem,
  deleteItem,
  deleteSection,
  deleteTrack,
  fillTrackFromIncidence,
  moveItem,
  moveSection,
  saveSection,
  saveTrack,
  setTrackPublished,
  updateItem,
} from "./tracks-admin.server";

function refreshScreens() {
  revalidatePath("/", "layout");
}

async function isTeacher(): Promise<boolean> {
  return Boolean(await getSessionWithRole("TEACHER"));
}

export async function saveTrackAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isTeacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = trackSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  let id: string;
  try {
    ({ id } = await saveTrack(parsed.data));
  } catch (error) {
    return stateFromError(error, "salvar a trilha");
  }
  refreshScreens();
  // `redirect` fica FORA do try: ele funciona lançando um "erro" especial do Next.js.
  if (!parsed.data.trackId) redirect(`/admin/conteudo/trilhas/${id}`);
  return successState("Trilha salva.");
}

export async function setTrackPublishedAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isTeacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = trackIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Trilha inválida.");
  try {
    await setTrackPublished(parsed.data.trackId, formData.get("isPublished") === "true");
  } catch (error) {
    return stateFromError(error, "publicar a trilha");
  }
  refreshScreens();
  return successState("Trilha atualizada.");
}

export async function deleteTrackAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isTeacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = trackIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Trilha inválida.");
  try {
    await deleteTrack(parsed.data.trackId);
  } catch (error) {
    return stateFromError(error, "apagar a trilha");
  }
  refreshScreens();
  redirect("/admin/conteudo/trilhas");
}

export async function fillTrackFromIncidenceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isTeacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = trackIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Trilha inválida.");
  try {
    await fillTrackFromIncidence(parsed.data.trackId);
  } catch (error) {
    return stateFromError(error, "montar as etapas");
  }
  refreshScreens();
  return successState("Etapas montadas pelo que mais cai.");
}

export async function saveSectionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isTeacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = sectionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await saveSection(parsed.data);
  } catch (error) {
    return stateFromError(error, "salvar a etapa");
  }
  refreshScreens();
  return successState(parsed.data.sectionId ? "Etapa salva." : "Etapa criada.");
}

export async function moveSectionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isTeacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = moveSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Etapa inválida.");
  try {
    await moveSection(parsed.data.id, parsed.data.direction);
  } catch (error) {
    return stateFromError(error, "mover a etapa");
  }
  refreshScreens();
  return successState("Etapa movida.");
}

export async function deleteSectionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isTeacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = sectionIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Etapa inválida.");
  try {
    await deleteSection(parsed.data.sectionId);
  } catch (error) {
    return stateFromError(error, "apagar a etapa");
  }
  refreshScreens();
  return successState("Etapa apagada.");
}

export async function addLessonItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isTeacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = lessonItemSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await addLessonItem(parsed.data);
  } catch (error) {
    return stateFromError(error, "incluir a aula");
  }
  refreshScreens();
  return successState("Aula incluída.");
}

export async function addPracticeItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isTeacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = practiceItemSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await addPracticeItem(parsed.data);
  } catch (error) {
    return stateFromError(error, "incluir o treino");
  }
  refreshScreens();
  return successState("Treino incluído.");
}

export async function updateItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isTeacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = updateItemSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await updateItem(parsed.data);
  } catch (error) {
    return stateFromError(error, "salvar o passo");
  }
  refreshScreens();
  return successState("Passo salvo.");
}

export async function moveItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isTeacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = moveSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Passo inválido.");
  try {
    await moveItem(parsed.data.id, parsed.data.direction);
  } catch (error) {
    return stateFromError(error, "mover o passo");
  }
  refreshScreens();
  return successState("Passo movido.");
}

export async function deleteItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isTeacher())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = itemIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Passo inválido.");
  try {
    await deleteItem(parsed.data.itemId);
  } catch (error) {
    return stateFromError(error, "tirar o passo");
  }
  refreshScreens();
  return successState("Passo tirado da trilha.");
}
