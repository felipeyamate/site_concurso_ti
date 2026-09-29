/**
 * admin-actions.ts — Server Action do painel de usuários: trocar o perfil (só ADMIN).
 *
 * Quem chama: o formulário "Perfil" em /admin/usuarios/[id] (`components/role-form.tsx`).
 * O que devolve: um `FormState` com a mensagem de sucesso ou o motivo da recusa.
 *
 * Passos: 1. confere login + perfil ADMIN; 2. valida os dados; 3. troca o perfil com as travas
 * (não mudar o próprio perfil, nunca ficar sem administrador); 4. atualiza as telas.
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  errorState,
  formDataToObject,
  invalidState,
  stateFromError,
  successState,
  type FormState,
} from "@/lib/form-state";

import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "./action-guards";
import { changeUserRole } from "./admin-users.server";
import { ROLES, ROLE_LABELS } from "./roles";

const changeRoleSchema = z.object({
  userId: z.string().min(1).max(200),
  role: z.enum(ROLES, { error: "Escolha um perfil válido." }),
});

export async function changeUserRoleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionWithRole("ADMIN");
  if (!session) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = changeRoleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    await changeUserRole({ actorId: session.user.id, userId: parsed.data.userId, role: parsed.data.role });
  } catch (error) {
    return stateFromError(error, "trocar perfil");
  }
  revalidatePath("/admin", "layout");
  return successState(`Perfil alterado para ${ROLE_LABELS[parsed.data.role]}.`);
}
