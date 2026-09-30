/**
 * actions.ts — Server Actions do blog no painel (PROFESSOR ou mais: é conteúdo).
 *
 * Quem chama: os formulários de `components/` (/admin/conteudo/blog...).
 * Toda ação: 1. confere login + perfil (`getSessionWithRole`); 2. valida (zod); 3. grava
 * (`blog-admin.server.ts`); 4. atualiza as telas do blog (lista, post, RSS, sitemap).
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { errorState, formDataToObject, invalidState, stateFromError, successState, type FormState } from "@/lib/form-state";
import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "@/modules/auth/action-guards";

import { deletePost, savePost, setPostPublished } from "./blog-admin.server";
import { blogPostIdSchema, blogPostSchema } from "./schemas";

function refreshScreens() {
  revalidatePath("/", "layout");
}

export async function savePostAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionWithRole("TEACHER");
  if (!session) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = blogPostSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  let id: string;
  try {
    ({ id } = await savePost(parsed.data, session.user.id));
  } catch (error) {
    return stateFromError(error, "salvar o post");
  }
  refreshScreens();
  if (!parsed.data.postId) redirect(`/admin/conteudo/blog/${id}`);
  return successState("Post salvo.");
}

export async function setPostPublishedAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("TEACHER"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = blogPostIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Post inválido.");
  try {
    await setPostPublished(parsed.data.postId, formData.get("isPublished") === "true");
  } catch (error) {
    return stateFromError(error, "publicar o post");
  }
  refreshScreens();
  return successState("Post atualizado.");
}

export async function deletePostAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("TEACHER"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = blogPostIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Post inválido.");
  try {
    await deletePost(parsed.data.postId);
  } catch (error) {
    return stateFromError(error, "apagar o post");
  }
  refreshScreens();
  redirect("/admin/conteudo/blog");
}
