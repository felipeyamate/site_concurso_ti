/**
 * dev-actions.ts — Server Actions da página de SIMULAÇÃO de pagamentos (/dev/pagamentos).
 *
 * Quem chama: `components/payment-simulator.tsx` (só existe fora de produção).
 * O que faz: dispara o "aviso do Asaas" simulado (pagar, estornar, contestar, próximo ciclo...)
 * pelo mesmo caminho dos avisos reais.
 *
 * Travas: 1. nunca em produção; 2. só cobranças SIMULADAS (FAKE); 3. só o dono da cobrança ou um
 * admin (uma Server Action pode ser chamada direto por HTTP, então conferimos tudo aqui).
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { errorState, formDataToObject, stateFromError, successState, type FormState } from "@/lib/form-state";
import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "@/modules/auth/action-guards";
import { hasMinimumRole } from "@/modules/auth/roles";

import { simulateNextCycle, simulatePaymentAction } from "./simulator.server";

const actionSchema = z.object({
  paymentId: z.string().min(1).max(200),
  action: z.enum(["PAY", "OVERDUE", "REFUND", "REFUND_DENIED", "CHARGEBACK", "DELETE"]),
});
const nextCycleSchema = z.object({ subscriptionId: z.string().min(1).max(200) });

const ACTION_MESSAGES: Record<z.infer<typeof actionSchema>["action"], string> = {
  PAY: "Pagamento simulado: o aviso de \"pago\" foi processado.",
  OVERDUE: "Aviso de \"vencida\" processado.",
  REFUND: "Aviso de \"estornada\" processado.",
  REFUND_DENIED: "Aviso de \"estorno negado\" processado.",
  CHARGEBACK: "Aviso de \"contestação\" processado.",
  DELETE: "Aviso de \"cobrança removida\" processado.",
};

/** Confere: fora de produção, logado, e dono (ou admin). Devolve a mensagem de erro ou null. */
async function checkAccess(ownerId: string | null | undefined): Promise<string | null> {
  if (env.NODE_ENV === "production") return "Simulação desligada em produção.";
  const session = await getSessionWithRole("STUDENT");
  if (!session) return PERMISSION_DENIED_MESSAGE;
  if (ownerId !== session.user.id && !hasMinimumRole(session.user.role, "ADMIN")) return PERMISSION_DENIED_MESSAGE;
  return null;
}

export async function simulatePaymentFormAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = actionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Pedido de simulação inválido.");
  const payment = await prisma.payment.findUnique({
    where: { id: parsed.data.paymentId },
    select: { order: { select: { userId: true } }, subscription: { select: { userId: true } } },
  });
  const denied = await checkAccess(payment?.order?.userId ?? payment?.subscription?.userId);
  if (denied) return errorState(denied);

  try {
    const outcome = await simulatePaymentAction({ paymentId: parsed.data.paymentId, action: parsed.data.action });
    revalidatePath("/", "layout");
    if (outcome.status === "failed") return errorState(`O processamento falhou: ${outcome.error}`);
    return successState(ACTION_MESSAGES[parsed.data.action]);
  } catch (error) {
    return stateFromError(error, "simular pagamento");
  }
}

export async function simulateNextCycleFormAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = nextCycleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return errorState("Assinatura inválida.");
  const subscription = await prisma.subscription.findUnique({
    where: { id: parsed.data.subscriptionId },
    select: { userId: true },
  });
  const denied = await checkAccess(subscription?.userId);
  if (denied) return errorState(denied);

  try {
    await simulateNextCycle({ subscriptionId: parsed.data.subscriptionId });
    revalidatePath("/", "layout");
    return successState("Cobrança do próximo ciclo criada (como o Asaas faria).");
  } catch (error) {
    return stateFromError(error, "simular próximo ciclo");
  }
}
