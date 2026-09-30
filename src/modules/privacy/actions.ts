/**
 * actions.ts — Server Actions de privacidade (LGPD): aceite dos termos, nome da conta, exclusão
 * de conta (pela pessoa e pelo admin).
 *
 * Quem chama: o formulário de cadastro (logo depois de criar a conta), a tela /aceitar-termos,
 * a página "Minha conta e privacidade" e a ficha do usuário no painel.
 * O que devolve: um `FormState` (mensagem para a tela) ou redireciona.
 *
 * Toda ação confere o login de novo (uma Server Action pode ser chamada direto por HTTP).
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { errorState, formDataToObject, invalidState, stateFromError, successState, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/db";
import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "@/modules/auth/action-guards";
import { auth } from "@/modules/auth/auth";
import { DEFAULT_AFTER_LOGIN_PATH, safeRedirectPath } from "@/modules/auth/redirect";
import { getCurrentSession } from "@/modules/auth/session";

import { adminDeleteAccount, deleteOwnAccount } from "./account-deletion.server";
import { recordLegalConsent, recordSignUpConsent } from "./consent.server";
import { requestMetadata } from "./request-metadata";

/**
 * Logo depois do cadastro com e-mail e senha: a pessoa marcou "Li e aceito" no formulário, então
 * gravamos o aceite (com IP e navegador) — só se a conta acabou de nascer (`recordSignUpConsent`).
 * Se não gravar, nada se perde: a área logada pede o aceite na tela /aceitar-termos.
 */
export async function recordSignUpConsentAction(): Promise<{ ok: boolean }> {
  const session = await getCurrentSession();
  if (!session) return { ok: false };
  const ok = await recordSignUpConsent({ userId: session.user.id, ...requestMetadata(await headers()) });
  return { ok };
}

/** Tela /aceitar-termos: grava o aceite e volta para a página que a pessoa queria abrir. */
export async function acceptLegalTermsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getCurrentSession();
  if (!session) return errorState("Sua sessão terminou. Entre de novo.");
  if (formData.get("accept") !== "on") {
    return errorState("Para continuar, marque que você leu e aceita os Termos de uso e a Política de privacidade.", {
      accept: "Marque para continuar.",
    });
  }
  try {
    await recordLegalConsent({ userId: session.user.id, source: "REVIEW", ...requestMetadata(await headers()) });
  } catch (error) {
    return stateFromError(error, "registrar o aceite dos termos");
  }
  redirect(safeRedirectPath(formData.get("voltar"), DEFAULT_AFTER_LOGIN_PATH));
}

const nameSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(100, "Nome muito longo."),
});

/** "Minha conta": corrigir o nome (LGPD, art. 18, III — correção de dados). */
export async function updateOwnNameAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getCurrentSession();
  if (!session) return errorState("Sua sessão terminou. Entre de novo.");
  const parsed = nameSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  await prisma.user.updateMany({ where: { id: session.user.id, deletedAt: null }, data: { name: parsed.data.name } });
  revalidatePath("/area-do-aluno", "layout");
  return successState("Nome atualizado.");
}

/**
 * "Excluir minha conta". Depois de excluir: encerra o login neste navegador (apaga o cookie) e
 * leva para a página inicial com o aviso de conta excluída.
 */
export async function deleteOwnAccountAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getCurrentSession();
  if (!session) return errorState("Sua sessão terminou. Entre de novo.");
  try {
    await deleteOwnAccount({
      userId: session.user.id,
      confirmation: String(formData.get("confirmation") ?? ""),
      sessionCreatedAt: new Date(session.session.createdAt),
    });
  } catch (error) {
    return stateFromError(error, "excluir a conta");
  }
  // O login já foi apagado no banco; aqui só limpamos o cookie deste navegador.
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Sem a sessão no banco, o cookie velho já não vale nada — não é motivo para mostrar erro.
  }
  redirect("/?conta=excluida");
}

/** Painel (só ADMIN): excluir a conta de alguém que pediu pelo suporte. */
export async function adminDeleteAccountAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionWithRole("ADMIN");
  if (!session) return errorState(PERMISSION_DENIED_MESSAGE);
  const userId = String(formData.get("userId") ?? "");
  try {
    await adminDeleteAccount({ actorId: session.user.id, userId, typedEmail: String(formData.get("typedEmail") ?? "") });
  } catch (error) {
    return stateFromError(error, "excluir a conta pelo painel");
  }
  revalidatePath("/admin/usuarios", "layout");
  return successState("Conta excluída (dados pessoais apagados; compras mantidas pela lei fiscal).");
}
