/**
 * commissions-table.tsx — Tabela das comissões de um afiliado (uma linha por cobrança paga).
 *
 * Quem chama: a área do afiliado e a ficha dele no painel.
 * Sem dados de quem comprou (LGPD): o que foi vendido, quando, o valor pago e a comissão.
 */
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { formatBRL } from "@/modules/payments/money";

import type { CommissionRow } from "../affiliates.server";
import { COMMISSION_STATUS_LABELS } from "../rules";

export function CommissionsTable({ rows }: { rows: CommissionRow[] }) {
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">Nenhuma venda paga ainda.</p>;
  return (
    // `relative`: os textos só para leitores de tela ficam presos aqui dentro (não alargam a página).
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-left">
          <tr>
            <th className="py-2 pr-3 font-medium">Pago em</th>
            <th className="py-2 pr-3 font-medium">Venda</th>
            <th className="py-2 pr-3 font-medium">Valor pago</th>
            <th className="py-2 pr-3 font-medium">Comissão</th>
            <th className="py-2 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.paymentId} className="border-t">
              <td className="py-2 pr-3 whitespace-nowrap">{row.paidAt ? formatDate(row.paidAt) : "—"}</td>
              <td className="py-2 pr-3">{row.description}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{formatBRL(row.valueCents)}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{formatBRL(row.amountCents)}</td>
              <td className="py-2">
                <Badge variant={row.status === "AVAILABLE" ? "default" : row.status === "CANCELED" ? "destructive" : "secondary"}>
                  {COMMISSION_STATUS_LABELS[row.status]}
                </Badge>
                {row.status === "HOLD" && row.releaseDate ? (
                  <span className="text-muted-foreground ml-1 text-xs">libera em {formatDate(row.releaseDate)}</span>
                ) : null}
                {row.refundedAfterPayout ? <span className="text-destructive ml-1 text-xs">estornada depois de paga</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
