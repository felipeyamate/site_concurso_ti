/**
 * actions.ts — Server Actions dos afiliados: painel (só ADMIN) e a área do próprio afiliado.
 *
 * Quem chama: os formulários de `components/` (/admin/vendas/afiliados e /area-do-aluno/afiliado).
 * O que devolve: um `FormState` (mensagem + erros por campo) ou redireciona.
 * Toda ação confere o login e o perfil de novo (`getSessionWithRole`): uma ação pode ser chamada
 * direto por HTTP. Na área do afiliado, a pessoa só mexe no PRÓPRIO cadastro (pelo ID da sessão).
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { errorState, formDataToObject, invalidState, stateFromError, successState, type FormState } from "@/lib/form-state";
import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "@/modules/auth/action-guards";
import { formatBRL } from "@/modules/payments/money";

import { createAffiliate, registerAffiliatePayout, updateAffiliate } from "./affiliates-admin.server";
import { updateOwnPayoutInfo } from "./affiliates.server";
import { createAffiliateSchema, ownPayoutInfoSchema, payoutSchema, updateAffiliateSchema } from "./schemas";

function refreshScreens() {
  revalidatePath("/admin/vendas", "layout");
  revalidatePath("/area-do-aluno", "layout");
}

export async function createAffiliateAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("ADMIN"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = createAffiliateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  let id: string;
  try {
    ({ id } = await createAffiliate(parsed.data));
  } catch (error) {
    return stateFromError(error, "cadastrar o afiliado");
  }
  refreshScreens();
  redirect(`/admin/vendas/afiliados/${id}`);
}

export async function updateAffiliateAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("ADMIN"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = updateAffiliateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await updateAffiliate(parsed.data);
  } catch (error) {
    return stateFromError(error, "salvar o afiliado");
  }
  refreshScreens();
  return successState("Afiliado salvo. A nova comissão vale para as próximas vendas.");
}

export async function registerPayoutAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionWithRole("ADMIN");
  if (!session) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = payoutSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    const result = await registerAffiliatePayout({ affiliateId: parsed.data.affiliateId, adminId: session.user.id, note: parsed.data.note });
    refreshScreens();
    return successState(`Pagamento de ${formatBRL(result.amountCents)} registrado (${result.count} comissão(ões)).`);
  } catch (error) {
    return stateFromError(error, "registrar o pagamento ao afiliado");
  }
}

/** Área do afiliado: a própria pessoa troca "como receber". */
export async function updateOwnPayoutInfoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionWithRole("STUDENT");
  if (!session) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = ownPayoutInfoSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await updateOwnPayoutInfo(session.user.id, parsed.data.payoutInfo);
  } catch (error) {
    return stateFromError(error, "salvar os dados de recebimento");
  }
  revalidatePath("/area-do-aluno/afiliado");
  return successState("Dados de recebimento salvos.");
}
