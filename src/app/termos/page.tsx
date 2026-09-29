/**
 * page.tsx — Termos de uso: /termos
 *
 * PROVISÓRIO: o texto definitivo (revisado juridicamente) entra na Fase 7 (LGPD),
 * junto com o registro de consentimento. A seção de compras e reembolso (Fase 4) já descreve as
 * regras que o site aplica — o checkout pede o aceite destes termos.
 */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <article className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Termos de uso</h1>
      <p className="text-muted-foreground">
        Texto em elaboração. Os termos definitivos serão publicados antes do lançamento da plataforma.
      </p>

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Compras, assinaturas e reembolso</h2>
        <ul className="grid list-disc gap-1 pl-5 text-sm leading-relaxed">
          <li>
            Os pagamentos são processados pelo Asaas (Pix, boleto ou cartão). Os dados do cartão são digitados na página do
            Asaas e não passam pelo nosso site.
          </li>
          <li>O acesso é liberado quando o pagamento é confirmado e vale pelo prazo informado na página de compra.</li>
          <li>
            Direito de arrependimento: você pode pedir o reembolso em até 7 dias depois do pagamento, em &quot;Minhas
            compras&quot;. O acesso daquela compra termina no momento do pedido. Pagamentos por boleto são devolvidos por
            transferência, combinada com a nossa equipe.
          </li>
          <li>
            Assinatura: renova a cada ciclo (mensal ou anual) até ser cancelada. Cancelando, o acesso continua até o fim do
            período já pago. O reembolso em 7 dias vale para o primeiro pagamento.
          </li>
          <li>Contestação do pagamento no cartão (chargeback) encerra o acesso da compra contestada.</li>
        </ul>
      </section>
    </article>
  );
}
