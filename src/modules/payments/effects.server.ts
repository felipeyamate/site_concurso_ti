/**
 * effects.server.ts — O que acontece DEPOIS que um pagamento muda de situação: e-mails e notas.
 *
 * Quem chama: o processamento das cobranças (`charges.server.ts`) e os reembolsos, sempre DEPOIS
 * de gravar no banco (fora da transação): um e-mail que falha não pode desfazer um pagamento.
 *
 * "Melhor esforço": cada efeito roda sozinho; se um falhar, vai para o log e os outros seguem.
 * Paralelo em Python: como disparar tarefas depois do `commit()` (o `transaction.on_commit` do Django).
 */
import "server-only";

import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/modules/email/send-email";
import { purchaseConfirmedTemplate, refundRequestedTemplate } from "@/modules/email/templates";

import { cancelFiscalInvoice, scheduleFiscalInvoice } from "./fiscal.server";

export type PaymentEffect =
  | { type: "ORDER_PAID"; orderId: string }
  | { type: "SUBSCRIPTION_STARTED"; subscriptionId: string }
  | { type: "REFUND_REQUESTED"; userId: string; itemTitle: string; manualRefund: boolean }
  | { type: "SCHEDULE_INVOICE"; paymentId: string }
  | { type: "CANCEL_INVOICE"; paymentId: string };

function siteUrl(path: string): string {
  return new URL(path, env.BETTER_AUTH_URL).toString();
}

async function runEffect(effect: PaymentEffect): Promise<void> {
  switch (effect.type) {
    case "ORDER_PAID": {
      const order = await prisma.order.findUnique({
        where: { id: effect.orderId },
        select: { productTitle: true, user: { select: { name: true, email: true } } },
      });
      if (!order) return;
      await sendEmail({
        to: order.user.email,
        ...purchaseConfirmedTemplate({ name: order.user.name, itemTitle: order.productTitle, url: siteUrl("/area-do-aluno") }),
      });
      return;
    }
    case "SUBSCRIPTION_STARTED": {
      const subscription = await prisma.subscription.findUnique({
        where: { id: effect.subscriptionId },
        select: { planTitle: true, user: { select: { name: true, email: true } } },
      });
      if (!subscription) return;
      await sendEmail({
        to: subscription.user.email,
        ...purchaseConfirmedTemplate({
          name: subscription.user.name,
          itemTitle: `a assinatura ${subscription.planTitle}`,
          url: siteUrl("/area-do-aluno"),
        }),
      });
      return;
    }
    case "REFUND_REQUESTED": {
      const user = await prisma.user.findUnique({ where: { id: effect.userId }, select: { name: true, email: true } });
      if (!user) return;
      await sendEmail({
        to: user.email,
        ...refundRequestedTemplate({
          name: user.name,
          itemTitle: effect.itemTitle,
          url: siteUrl("/area-do-aluno/compras"),
          manualRefund: effect.manualRefund,
        }),
      });
      return;
    }
    case "SCHEDULE_INVOICE":
      await scheduleFiscalInvoice(effect.paymentId);
      return;
    case "CANCEL_INVOICE":
      await cancelFiscalInvoice(effect.paymentId);
      return;
  }
}

/** Roda os efeitos, um por um; falhas vão para o log (não interrompem os demais). */
export async function runEffects(effects: PaymentEffect[]): Promise<void> {
  for (const effect of effects) {
    try {
      await runEffect(effect);
    } catch (error) {
      console.error(`[vendas] Falha no efeito ${effect.type}:`, error);
    }
  }
}
