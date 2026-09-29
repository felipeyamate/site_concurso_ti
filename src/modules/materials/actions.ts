/**
 * actions.ts — Server Actions dos materiais (PDFs) no painel: preparar envio, confirmar e apagar.
 *
 * Quem chama: `components/attachment-manager.tsx` (no navegador, no painel da aula).
 * O que devolve: um `FormState` (como os outros formulários do painel); o passo 1 devolve também
 * o link de envio quando dá certo.
 *
 * Toda ação: 1. confere login + perfil (professor ou admin); 2. valida a entrada (zod);
 * 3. chama as regras de `materials.server.ts`; 4. atualiza as telas.
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { errorState, formDataToObject, stateFromError, successState, type FormState } from "@/lib/form-state";
import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "@/modules/auth/action-guards";
import { getFileStorage } from "@/modules/storage/storage.server";
import type { UploadTarget } from "@/modules/storage/types";

import { confirmAttachmentUpload, deleteAttachment, prepareAttachmentUpload } from "./materials.server";

type PrepareUploadResult = { ok: true; key: string; target: UploadTarget } | { ok: false; state: FormState };

const STORAGE_OFF_MESSAGE =
  "O armazenamento de arquivos não está configurado (Cloudflare R2). Veja o README, seção da Fase 3.";

const prepareSchema = z.object({
  lessonId: z.string().min(1).max(200),
  fileName: z.string().min(1).max(500),
  sizeBytes: z.number().int().nonnegative(),
  contentType: z.string().max(200),
});

const confirmSchema = z.object({
  lessonId: z.string().min(1).max(200),
  key: z.string().min(1).max(300),
  title: z.string().max(500),
  fileName: z.string().min(1).max(500),
});

// Atualiza as páginas que mostram materiais (painel e página da aula).
function refreshScreens() {
  revalidatePath("/", "layout");
}

/** Passo 1: devolve o link temporário para o navegador enviar o PDF direto ao armazenamento. */
export async function prepareAttachmentUploadAction(input: unknown): Promise<PrepareUploadResult> {
  if (!(await getSessionWithRole("TEACHER"))) return { ok: false, state: errorState(PERMISSION_DENIED_MESSAGE) };
  const parsed = prepareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, state: errorState("Dados do arquivo inválidos.") };
  const storage = getFileStorage();
  if (!storage) return { ok: false, state: errorState(STORAGE_OFF_MESSAGE) };

  try {
    const { key, target } = await prepareAttachmentUpload({ storage, ...parsed.data });
    return { ok: true, key, target };
  } catch (error) {
    return { ok: false, state: stateFromError(error, "preparar o envio do PDF") };
  }
}

/** Passo 3: confere o arquivo enviado e registra o material. */
export async function confirmAttachmentUploadAction(input: unknown): Promise<FormState> {
  if (!(await getSessionWithRole("TEACHER"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return errorState("Dados do envio inválidos.");
  const storage = getFileStorage();
  if (!storage) return errorState(STORAGE_OFF_MESSAGE);

  try {
    await confirmAttachmentUpload({ storage, ...parsed.data });
  } catch (error) {
    return stateFromError(error, "confirmar o envio do PDF");
  }
  refreshScreens();
  return successState("Material enviado.");
}

/** Apaga um material (botão "Apagar" na lista). */
export async function deleteAttachmentAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("TEACHER"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = z.object({ id: z.string().min(1).max(200) }).safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Material inválido.");

  try {
    await deleteAttachment({ storage: getFileStorage(), attachmentId: parsed.data.id });
  } catch (error) {
    return stateFromError(error, "apagar material");
  }
  refreshScreens();
  return successState("Material apagado.");
}
