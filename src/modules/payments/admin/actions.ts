/**
 * actions.ts — Server Actions do painel de VENDAS (só ADMIN): produtos, planos, cursos da
 * assinatura, reembolsos, cancelamentos, conferência com o provedor, avisos e notas fiscais.
 *
 * Quem chama: os formulários de `components/` e as páginas /admin/vendas/...
 * O que devolve: um `FormState` ou redireciona.
 *
 * Toda ação: 1. confere login + perfil ADMIN (`getSessionWithRole`) — dinheiro e dados pessoais
 * ficam só com o admin; 2. valida (zod); 3. chama `sales-admin.server.ts`; 4. atualiza as telas.
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

import { cancelSubscription, requestOrderRefund } from "../refunds.server";
import {
  cancelSubscriptionSchema,
  createPlanSchema,
  createProductSchema,
  idSchema,
  orderIdSchema,
  subscriptionCoursesSchema,
  updatePlanSchema,
  updateProductSchema,
} from "../schemas";
import {
  createPlan,
  createProduct,
  deletePlan,
  deleteProduct,
  reprocessWebhookEvent,
  retryFiscalInvoice,
  setSubscriptionCourses,
  syncPaymentWithProvider,
  updatePlan,
  updateProduct,
} from "./sales-admin.server";

function refreshScreens() {
  revalidatePath("/", "layout");
}

async function adminSession() {
  return getSessionWithRole("ADMIN");
}

// ---------------------------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------------------------

export async function createProductAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await adminSession())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = createProductSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  let productId: string;
  try {
    ({ id: productId } = await createProduct({
      title: parsed.data.title,
      priceCents: parsed.data.price,
      accessDays: parsed.data.accessDays,
      maxInstallments: parsed.data.maxInstallments,
    }));
  } catch (error) {
    return stateFromError(error, "criar produto");
  }
  refreshScreens();
  redirect(`/admin/vendas/produtos/${productId}`);
}

export async function updateProductAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await adminSession())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = updateProductSchema.safeParse(formDataWithLists(formData, ["courseIds"]));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    await updateProduct({
      productId: parsed.data.productId,
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description,
      priceCents: parsed.data.price,
      accessDays: parsed.data.accessDays,
      maxInstallments: parsed.data.maxInstallments,
      isActive: parsed.data.isActive,
      courseIds: parsed.data.courseIds,
    });
  } catch (error) {
    return stateFromError(error, "salvar produto");
  }
  refreshScreens();
  return successState("Produto salvo.");
}

export async function deleteProductAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await adminSession())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = idSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Produto inválido.");
  try {
    await deleteProduct(parsed.data.id);
  } catch (error) {
    return stateFromError(error, "apagar produto");
  }
  refreshScreens();
  redirect("/admin/vendas/produtos");
}

// ---------------------------------------------------------------------------------------------
// Planos e cursos da assinatura
// ---------------------------------------------------------------------------------------------

export async function createPlanAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await adminSession())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = createPlanSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  let planId: string;
  try {
    ({ id: planId } = await createPlan({ title: parsed.data.title, priceCents: parsed.data.price, cycle: parsed.data.cycle }));
  } catch (error) {
    return stateFromError(error, "criar plano");
  }
  refreshScreens();
  redirect(`/admin/vendas/planos/${planId}`);
}

export async function updatePlanAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await adminSession())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = updatePlanSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    await updatePlan({
      planId: parsed.data.planId,
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description,
      priceCents: parsed.data.price,
      cycle: parsed.data.cycle,
      isActive: parsed.data.isActive,
    });
  } catch (error) {
    return stateFromError(error, "salvar plano");
  }
  refreshScreens();
  return successState("Plano salvo. (Assinaturas já feitas continuam com o preço e o ciclo da época.)");
}

export async function deletePlanAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await adminSession())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = idSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Plano inválido.");
  try {
    await deletePlan(parsed.data.id);
  } catch (error) {
    return stateFromError(error, "apagar plano");
  }
  refreshScreens();
  redirect("/admin/vendas/planos");
}

export async function setSubscriptionCoursesAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await adminSession())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = subscriptionCoursesSchema.safeParse(formDataWithLists(formData, ["courseIds"]));
  if (!parsed.success) return invalidState(parsed.error);
  try {
    const subscribers = await setSubscriptionCourses(parsed.data.courseIds);
    refreshScreens();
    return successState(`Cursos da assinatura salvos. Acesso recalculado para ${subscribers} assinante(s).`);
  } catch (error) {
    return stateFromError(error, "salvar os cursos da assinatura");
  }
}

// ---------------------------------------------------------------------------------------------
// Pedidos, assinaturas, avisos e notas (suporte)
// ---------------------------------------------------------------------------------------------

export async function adminRefundOrderAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = orderIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Pedido inválido.");
  try {
    const { manualRefund } = await requestOrderRefund({
      orderId: parsed.data.orderId,
      actor: { userId: session.user.id, isAdmin: true },
    });
    refreshScreens();
    return successState(
      manualRefund
        ? "Reembolso registrado e acesso retirado. BOLETO: faça o estorno no painel do Asaas (ele pede os dados bancários do aluno)."
        : "Estorno pedido ao provedor e acesso retirado.",
    );
  } catch (error) {
    return stateFromError(error, "reembolsar pedido");
  }
}

export async function adminCancelSubscriptionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = cancelSubscriptionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Assinatura inválida.");
  try {
    const result = await cancelSubscription({
      subscriptionId: parsed.data.subscriptionId,
      actor: { userId: session.user.id, isAdmin: true },
      refund: parsed.data.refund,
    });
    refreshScreens();
    if (result.cancelFailure) {
      return errorState(
        `O estorno foi pedido, mas o provedor não cancelou a assinatura (${result.cancelFailure}). Clique em "Cancelar" de novo.`,
      );
    }
    return successState(result.refunded ? "Assinatura cancelada e último pagamento estornado." : "Assinatura cancelada.");
  } catch (error) {
    return stateFromError(error, "cancelar assinatura");
  }
}

export async function syncPaymentAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await adminSession())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = idSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Cobrança inválida.");
  try {
    const note = await syncPaymentWithProvider(parsed.data.id);
    refreshScreens();
    return successState(note);
  } catch (error) {
    return stateFromError(error, "conferir cobrança no provedor");
  }
}

export async function reprocessWebhookAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await adminSession())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = idSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Aviso inválido.");
  try {
    const outcome = await reprocessWebhookEvent(parsed.data.id);
    refreshScreens();
    return outcome.status === "failed" ? errorState(`Falhou de novo: ${outcome.error}`) : successState("Aviso reprocessado.");
  } catch (error) {
    return stateFromError(error, "reprocessar aviso");
  }
}

export async function retryFiscalInvoiceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await adminSession())) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = idSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Cobrança inválida.");
  try {
    await retryFiscalInvoice(parsed.data.id);
    refreshScreens();
    return successState("Nota fiscal pedida de novo. Confira a situação em alguns minutos.");
  } catch (error) {
    return stateFromError(error, "emitir nota fiscal");
  }
}
