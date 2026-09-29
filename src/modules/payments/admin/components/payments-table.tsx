/**
 * payments-table.tsx — Tabela das cobranças de um pedido ou assinatura, no painel de vendas.
 *
 * Quem chama: /admin/vendas/pedidos/[id] e /admin/vendas/assinaturas/[id].
 * Por cobrança: situação, valor, vencimento, pagamento, nota fiscal e as ações de suporte:
 *  - "Conferir no Asaas": busca a situação atual no provedor (quando um aviso se perdeu);
 *  - "Emitir nota de novo": quando a nota deu erro.
 */
import { ActionButton } from "@/components/admin/action-button";
import type { FiscalInvoiceStatus, PaymentProviderKind, PaymentStatus } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";

import { formatDateOnly } from "../../dates";
import { FISCAL_INVOICE_STATUS_LABELS } from "../../labels";
import { formatBRL } from "../../money";
import { PaymentStatusBadge } from "../../components/status-badge";
import { retryFiscalInvoiceAction, syncPaymentAction } from "../actions";

type PaymentRow = {
  id: string;
  provider: PaymentProviderKind;
  providerPaymentId: string;
  status: PaymentStatus;
  providerStatus: string;
  valueCents: number;
  dueDate: Date;
  paidAt: Date | null;
  installmentNumber: number | null;
  fiscalInvoice: { status: FiscalInvoiceStatus; number: string | null; pdfUrl: string | null; error: string | null } | null;
};

export function PaymentsTable({ payments }: { payments: PaymentRow[] }) {
  if (payments.length === 0) return <p className="text-muted-foreground text-sm">Nenhuma cobrança registrada.</p>;
  return (
    // `relative`: o texto "sr-only" do cabeçalho fica preso aqui dentro, sem alargar a página.
    <div className="relative overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground border-b">
          <tr>
            <th className="p-3 font-medium">Cobrança</th>
            <th className="p-3 font-medium">Situação</th>
            <th className="p-3 font-medium">Valor</th>
            <th className="p-3 font-medium">Vencimento</th>
            <th className="p-3 font-medium">Pago em</th>
            <th className="p-3 font-medium">Nota fiscal</th>
            <th className="p-3 font-medium">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {payments.map((payment) => {
            const invoice = payment.fiscalInvoice;
            const invoiceFailed = invoice && (invoice.status === "ERROR" || (invoice.status === "PENDING" && invoice.error));
            return (
              <tr key={payment.id}>
                <td className="p-3">
                  <code className="text-xs">{payment.providerPaymentId}</code>
                  {payment.installmentNumber ? <span className="text-muted-foreground block text-xs">parcela {payment.installmentNumber}</span> : null}
                </td>
                <td className="p-3">
                  <PaymentStatusBadge status={payment.status} />
                  <span className="text-muted-foreground block text-xs">{payment.providerStatus}</span>
                </td>
                <td className="p-3 whitespace-nowrap">{formatBRL(payment.valueCents)}</td>
                <td className="p-3 whitespace-nowrap">{formatDateOnly(payment.dueDate)}</td>
                <td className="p-3 whitespace-nowrap">{payment.paidAt ? formatDateTime(payment.paidAt) : "—"}</td>
                <td className="p-3">
                  {invoice ? (
                    <>
                      {invoice.pdfUrl ? (
                        <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" className="underline">
                          {FISCAL_INVOICE_STATUS_LABELS[invoice.status]}
                          {invoice.number ? ` nº ${invoice.number}` : ""}
                        </a>
                      ) : (
                        <span>
                          {FISCAL_INVOICE_STATUS_LABELS[invoice.status]}
                          {invoice.number ? ` nº ${invoice.number}` : ""}
                        </span>
                      )}
                      {invoice.error ? <span className="text-destructive block max-w-xs text-xs">{invoice.error}</span> : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3">
                  <div className="flex flex-col items-end gap-1">
                    {payment.provider === "ASAAS" ? (
                      <ActionButton action={syncPaymentAction} fields={{ id: payment.id }} variant="outline" size="sm">
                        Conferir no Asaas
                      </ActionButton>
                    ) : null}
                    {invoiceFailed ? (
                      <ActionButton action={retryFiscalInvoiceAction} fields={{ id: payment.id }} variant="outline" size="sm">
                        Emitir nota de novo
                      </ActionButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
