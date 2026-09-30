/**
 * actions.ts — Server Actions de compra do ALUNO: comprar, assinar, pedir reembolso, cancelar.
 *
 * Quem chama: os formulários de `components/` (checkout, "Minhas compras").
 * O que devolve: um `FormState` (mensagem + erros por campo) ou redireciona para a página de
 * pagamento.
 *
 * Toda ação: 1. confere o LOGIN (qualquer perfil pode comprar); 2. valida o formulário (zod);
 * 3. chama as regras (`checkout.server.ts`, `refunds.server.ts`); 4. atualiza as telas.
 * O preço nunca vem do formulário: o servidor busca o produto/plano no banco (e o cupom, se houver).
 * O afiliado vem do cookie do link de divulgação (`/r/<codigo>`), lido aqui no servidor.
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { errorState, formDataToObject, invalidState, stateFromError, successState, type FormState } from "@/lib/form-state";
import { AFFILIATE_COOKIE } from "@/modules/affiliates/rules";
import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "@/modules/auth/action-guards";

import { createOrder, startSubscription } from "./checkout.server";
import { cancelSubscription, requestOrderRefund } from "./refunds.server";
import { cancelSubscriptionSchema, checkoutSchema, orderIdSchema, subscribeSchema } from "./schemas";

const LOGIN_MESSAGE = "Entre na sua conta para continuar.";

function refreshScreens() {
  // Compras mudam a área do aluno, as páginas dos cursos e o painel.
  revalidatePath("/", "layout");
}

/** O código do afiliado guardado pelo link de divulgação (ou null). */
async function affiliateCodeFromCookie(): Promise<string | null> {
  return (await cookies()).get(AFFILIATE_COOKIE)?.value ?? null;
}

/** Depois de criar a cobrança, vai para a página "como pagar" (ou para "Minhas compras"). */
function paymentPage(paymentId: string | null): string {
  return paymentId ? `/area-do-aluno/pagamentos/${paymentId}` : "/area-do-aluno/compras";
}

export async function checkoutAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionWithRole("STUDENT");
  if (!session) return errorState(LOGIN_MESSAGE);
  const parsed = checkoutSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  let paymentId: string | null;
  try {
    ({ paymentId } = await createOrder({
      buyer: { id: session.user.id, name: session.user.name, email: session.user.email },
      productSlug: parsed.data.productSlug,
      method: parsed.data.method,
      installments: parsed.data.installments,
      billing: { cpf: parsed.data.cpf, phone: parsed.data.phone },
      couponCode: parsed.data.couponCode,
      affiliateCode: await affiliateCodeFromCookie(),
    }));
  } catch (error) {
    return stateFromError(error, "criar o pedido");
  }
  refreshScreens();
  // `redirect` fica FORA do try: ele funciona lançando um "erro" especial do Next.js.
  redirect(paymentPage(paymentId));
}

export async function subscribeAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionWithRole("STUDENT");
  if (!session) return errorState(LOGIN_MESSAGE);
  const parsed = subscribeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  let paymentId: string | null;
  try {
    ({ paymentId } = await startSubscription({
      buyer: { id: session.user.id, name: session.user.name, email: session.user.email },
      planSlug: parsed.data.planSlug,
      method: parsed.data.method,
      billing: { cpf: parsed.data.cpf, phone: parsed.data.phone },
      couponCode: parsed.data.couponCode,
      affiliateCode: await affiliateCodeFromCookie(),
    }));
  } catch (error) {
    return stateFromError(error, "criar a assinatura");
  }
  refreshScreens();
  redirect(paymentPage(paymentId));
}

export async function requestRefundAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionWithRole("STUDENT");
  if (!session) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = orderIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Pedido inválido.");

  try {
    // Aqui o pedido é sempre tratado como do ALUNO (prazo de 7 dias), mesmo para um admin
    // comprando: o reembolso "de suporte" fica no painel.
    const { manualRefund } = await requestOrderRefund({
      orderId: parsed.data.orderId,
      actor: { userId: session.user.id, isAdmin: false },
    });
    refreshScreens();
    return successState(
      manualRefund
        ? "Reembolso pedido. Como foi boleto, vamos entrar em contato para combinar a devolução."
        : "Reembolso pedido. O valor volta na mesma forma de pagamento.",
    );
  } catch (error) {
    return stateFromError(error, "pedir reembolso");
  }
}

export async function cancelSubscriptionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await getSessionWithRole("STUDENT");
  if (!session) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = cancelSubscriptionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Assinatura inválida.");

  try {
    const result = await cancelSubscription({
      subscriptionId: parsed.data.subscriptionId,
      actor: { userId: session.user.id, isAdmin: false },
      refund: parsed.data.refund,
    });
    refreshScreens();
    if (result.cancelFailure) {
      return errorState(
        `O reembolso foi pedido, mas o provedor não cancelou a assinatura (${result.cancelFailure}). Clique em "Cancelar assinatura" de novo.`,
      );
    }
    return successState(
      result.refunded
        ? "Assinatura cancelada e reembolso pedido."
        : "Assinatura cancelada. Você continua com acesso até o fim do período já pago.",
    );
  } catch (error) {
    return stateFromError(error, "cancelar a assinatura");
  }
}
