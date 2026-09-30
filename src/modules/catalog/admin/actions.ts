/**
 * actions.ts — Server Actions do painel de cursos: criar, editar, reordenar e apagar cursos,
 * módulos e aulas; definir o vídeo da aula; listar a biblioteca do Panda.
 *
 * Quem chama: os formulários de `components/` (páginas /admin/cursos/...).
 * O que devolve: um `FormState` (mensagem + erros por campo) ou redireciona para outra página.
 *
 * Toda ação segue os mesmos passos (uma Server Action pode ser chamada direto por HTTP):
 *  1. confere login + perfil mínimo PROFESSOR (`getSessionWithRole`);
 *  2. valida os dados do formulário (zod, `schemas.ts`);
 *  3. grava (`catalog-admin.server.ts`);
 *  4. atualiza as telas (`revalidatePath`) — o catálogo público muda junto.
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { isProductionSite } from "@/lib/runtime";
import {
  errorState,
  formDataToObject,
  formDataWithLists,
  invalidState,
  stateFromError,
  successState,
  type FormState,
} from "@/lib/form-state";
import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "@/modules/auth/action-guards";
import { deleteStoredFiles } from "@/modules/materials/materials.server";
import { getFileStorage } from "@/modules/storage/storage.server";
import { listPandaVideos, PandaApiError, type PandaLibraryVideo } from "@/modules/video/panda/panda-api";

import {
  createCourse,
  createLesson,
  createModule,
  deleteCourse,
  deleteLesson,
  deleteModule,
  moveCourse,
  moveLesson,
  moveModule,
  renameModule,
  setLessonSubjects,
  updateCourse,
  updateLesson,
  updateLessonVideo,
} from "./catalog-admin.server";
import {
  createCourseSchema,
  createLessonSchema,
  createModuleSchema,
  idSchema,
  lessonSubjectsSchema,
  moveSchema,
  renameModuleSchema,
  updateCourseSchema,
  updateLessonSchema,
  updateLessonVideoSchema,
} from "./schemas";

/**
 * Atualiza todas as telas depois de uma mudança no catálogo.
 * Mudanças no painel são raras; "tudo" é o mais simples e nunca deixa uma tela desatualizada
 * (vitrine, página do curso, aulas, área do aluno e o próprio painel).
 */
function refreshCatalogScreens() {
  revalidatePath("/", "layout");
}

async function isStaff(): Promise<boolean> {
  return Boolean(await getSessionWithRole("TEACHER"));
}

// =============================================================================================
// Cursos
// =============================================================================================

export async function createCourseAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = createCourseSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  let courseId: string;
  try {
    courseId = (await createCourse(parsed.data)).id;
  } catch (error) {
    return stateFromError(error, "criar curso");
  }
  refreshCatalogScreens();
  // `redirect` fica FORA do try: ele funciona lançando um "erro" especial que o Next.js trata.
  redirect(`/admin/cursos/${courseId}`);
}

export async function updateCourseAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = updateCourseSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    await updateCourse(parsed.data);
  } catch (error) {
    return stateFromError(error, "salvar curso");
  }
  refreshCatalogScreens();
  return successState("Curso salvo.");
}

export async function moveCourseAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = moveSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    await moveCourse(parsed.data.id, parsed.data.direction);
  } catch (error) {
    return stateFromError(error, "reordenar cursos");
  }
  refreshCatalogScreens();
  return successState("Ordem atualizada.");
}

export async function deleteCourseAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = idSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    const storageKeys = await deleteCourse(parsed.data.id);
    await deleteStoredFiles(getFileStorage(), storageKeys);
  } catch (error) {
    return stateFromError(error, "apagar curso");
  }
  refreshCatalogScreens();
  redirect("/admin/cursos");
}

// =============================================================================================
// Módulos
// =============================================================================================

export async function createModuleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = createModuleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    await createModule(parsed.data);
  } catch (error) {
    return stateFromError(error, "criar módulo");
  }
  refreshCatalogScreens();
  return successState("Módulo criado.");
}

export async function renameModuleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = renameModuleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    await renameModule(parsed.data);
  } catch (error) {
    return stateFromError(error, "renomear módulo");
  }
  refreshCatalogScreens();
  return successState("Módulo salvo.");
}

export async function moveModuleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = moveSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    await moveModule(parsed.data.id, parsed.data.direction);
  } catch (error) {
    return stateFromError(error, "reordenar módulos");
  }
  refreshCatalogScreens();
  return successState("Ordem atualizada.");
}

export async function deleteModuleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = idSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    await deleteModule(parsed.data.id);
  } catch (error) {
    return stateFromError(error, "apagar módulo");
  }
  refreshCatalogScreens();
  return successState("Módulo apagado.");
}

// =============================================================================================
// Aulas
// =============================================================================================

export async function createLessonAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = createLessonSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  let lesson: { id: string; courseId: string };
  try {
    lesson = await createLesson(parsed.data);
  } catch (error) {
    return stateFromError(error, "criar aula");
  }
  refreshCatalogScreens();
  redirect(`/admin/cursos/${lesson.courseId}/aulas/${lesson.id}`);
}

export async function updateLessonAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = updateLessonSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    await updateLesson(parsed.data);
  } catch (error) {
    return stateFromError(error, "salvar aula");
  }
  refreshCatalogScreens();
  return successState("Aula salva.");
}

/** Fase 8: os assuntos que a aula ensina (caixas marcadas → lista). */
export async function setLessonSubjectsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = lessonSubjectsSchema.safeParse(formDataWithLists(formData, ["subjectIds"]));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await setLessonSubjects(parsed.data);
  } catch (error) {
    return stateFromError(error, "salvar os assuntos da aula");
  }
  refreshCatalogScreens();
  return successState("Assuntos salvos.");
}

export async function updateLessonVideoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = updateLessonVideoSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    // Mesma regra do provedor do vídeo de exemplo: recusado só no site de produção de verdade.
    await updateLessonVideo({ ...parsed.data, isProduction: isProductionSite() });
  } catch (error) {
    return stateFromError(error, "salvar vídeo da aula");
  }
  refreshCatalogScreens();
  return successState("Vídeo salvo.");
}

export async function moveLessonAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = moveSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    await moveLesson(parsed.data.id, parsed.data.direction);
  } catch (error) {
    return stateFromError(error, "reordenar aulas");
  }
  refreshCatalogScreens();
  return successState("Ordem atualizada.");
}

export async function deleteLessonAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await isStaff())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = idSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  let courseId: string;
  try {
    const deleted = await deleteLesson(parsed.data.id);
    courseId = deleted.courseId;
    await deleteStoredFiles(getFileStorage(), deleted.storageKeys);
  } catch (error) {
    return stateFromError(error, "apagar aula");
  }
  refreshCatalogScreens();
  redirect(`/admin/cursos/${courseId}`);
}

// =============================================================================================
// Biblioteca do Panda (para escolher o vídeo da aula sem copiar e colar o link)
// =============================================================================================

export type PandaLibraryResult = { ok: true; videos: PandaLibraryVideo[] } | { ok: false; error: string };

export async function listPandaVideosAction(search: unknown): Promise<PandaLibraryResult> {
  if (!(await isStaff())) return { ok: false, error: PERMISSION_DENIED_MESSAGE };
  if (!env.PANDA_API_KEY) {
    return { ok: false, error: "A chave da API do Panda (PANDA_API_KEY) não está configurada." };
  }
  const query = typeof search === "string" ? search.slice(0, 100) : "";
  try {
    return { ok: true, videos: await listPandaVideos({ apiKey: env.PANDA_API_KEY, search: query }) };
  } catch (error) {
    if (error instanceof PandaApiError) {
      console.error("[panda] Falha ao listar vídeos:", error.cause ?? error.message);
      return { ok: false, error: error.message };
    }
    console.error("[panda] Falha inesperada ao listar vídeos:", error);
    return { ok: false, error: "Não foi possível listar os vídeos do Panda agora." };
  }
}
