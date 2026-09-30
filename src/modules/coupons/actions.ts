/**
 * actions.ts — Server Actions dos cupons no painel (só ADMIN).
 *
 * Quem chama: os formulários de `components/` (/admin/vendas/cupons...).
 * O que devolve: um `FormState` (mensagem + erros por campo) ou redireciona.
 * Toda ação: 1. confere login + perfil ADMIN (`getSessionWithRole` — uma ação pode ser chamada
 * direto por HTTP); 2. valida (zod); 3. grava (`coupons-admin.server.ts`); 4. atualiza as telas.
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { errorState, formDataToObject, formDataWithLists, invalidState, stateFromError, successState, type FormState } from "@/lib/form-state";
import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "@/modules/auth/action-guards";

import { deleteCoupon, saveCoupon, setCouponActive } from "./coupons-admin.server";
import { couponFormSchema, couponIdSchema } from "./schemas";

function refreshScreens() {
  // Cupons mudam as páginas de compra e as de edital (que oferecem cupom).
  revalidatePath("/", "layout");
}

export async function saveCouponAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("ADMIN"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = couponFormSchema.safeParse(formDataWithLists(formData, ["productIds", "planIds"]));
  if (!parsed.success) return invalidState(parsed.error);
  let id: string;
  try {
    ({ id } = await saveCoupon(parsed.data));
  } catch (error) {
    return stateFromError(error, "salvar o cupom");
  }
  refreshScreens();
  // Cupom novo: vai para a página dele. Edição: fica na mesma página, com a mensagem.
  if (!parsed.data.couponId) redirect(`/admin/vendas/cupons/${id}`);
  return successState("Cupom salvo.");
}

export async function setCouponActiveAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("ADMIN"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = couponIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Cupom inválido.");
  try {
    await setCouponActive(parsed.data.couponId, formData.get("isActive") === "true");
  } catch (error) {
    return stateFromError(error, "ativar/desativar o cupom");
  }
  refreshScreens();
  return successState("Cupom atualizado.");
}

export async function deleteCouponAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("ADMIN"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = couponIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Cupom inválido.");
  try {
    await deleteCoupon(parsed.data.couponId);
  } catch (error) {
    return stateFromError(error, "apagar o cupom");
  }
  refreshScreens();
  redirect("/admin/vendas/cupons");
}
