/**
 * status-badge.tsx — Etiqueta colorida da situação de um pedido, cobrança ou assinatura.
 *
 * Quem chama: "Minhas compras", a página de pagamento e o painel de vendas.
 * Verde (padrão) = pago/ativo; vermelho = estorno/contestação; cinza = o resto.
 */
import type { OrderStatus, PaymentStatus, SubscriptionStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";

import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS } from "../labels";

type Variant = "default" | "secondary" | "destructive" | "outline";

const GOOD = new Set<string>(["PAID", "CONFIRMED", "RECEIVED", "ACTIVE"]);
const BAD = new Set<string>(["REFUND_REQUESTED", "REFUNDED", "CHARGEBACK"]);

function variantFor(status: string): Variant {
  if (GOOD.has(status)) return "default";
  if (BAD.has(status)) return "destructive";
  return "secondary";
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={variantFor(status)}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={variantFor(status)}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>{SUBSCRIPTION_STATUS_LABELS[status]}</Badge>;
}
