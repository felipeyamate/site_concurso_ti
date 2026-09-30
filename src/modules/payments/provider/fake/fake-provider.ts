/**
 * fake-provider.ts — Provedor de pagamento SIMULADO (só desenvolvimento, sem conta no Asaas).
 *
 * Quem chama: `provider.server.ts`, quando não há ASAAS_API_KEY e o app NÃO está em produção.
 *
 * Como funciona: cria cobranças "de mentira" (IDs `pay_fake_...`) cuja página de pagamento é a
 * nossa `/dev/pagamentos/<id>`. Lá, botões simulam o que o Asaas faria ("pagar", "estornar",
 * "contestar") gerando AVISOS no formato do Asaas — processados pelo MESMO código que trata os
 * avisos reais (`webhook.server.ts`). Assim o fluxo inteiro é testado sem dinheiro nem conta.
 * Mesma ideia do vídeo de exemplo (Fase 2) e da pasta local de PDFs (Fase 3).
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { PaymentProviderError, type PaymentProvider, type ProviderCharge } from "../types";

function fakeId(prefix: string): string {
  return `${prefix}_fake_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

// QR Code "de mentira" (um quadro com o texto PIX SIMULADO), já no formato de imagem para <img>.
const FAKE_QR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><rect x="10" y="10" width="180" height="180" fill="none" stroke="#111" stroke-width="8"/><text x="100" y="95" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#111">PIX</text><text x="100" y="125" font-family="sans-serif" font-size="18" text-anchor="middle" fill="#111">SIMULADO</text></svg>`;

/** Endereço da página que simula o pagamento de uma cobrança. */
export function fakePaymentPageUrl(paymentId: string): string {
  return `/dev/pagamentos/${encodeURIComponent(paymentId)}`;
}

export function createFakeProvider(): PaymentProvider {
  return {
    kind: "FAKE",

    async createCustomer() {
      return { customerId: fakeId("cus") };
    },

    async createCharge(input): Promise<ProviderCharge> {
      const paymentId = fakeId("pay");
      const installments = Math.max(1, input.installments);
      return {
        paymentId,
        installmentId: installments > 1 ? fakeId("ins") : null,
        subscriptionId: null,
        externalReference: input.externalReference,
        method: input.method,
        status: "PENDING",
        providerStatus: "PENDING",
        // Parcelado: esta é a 1ª parcela (o Asaas faz igual).
        valueCents: installments > 1 ? Math.ceil(input.valueCents / installments) : input.valueCents,
        dueDate: input.dueDate,
        installmentNumber: installments > 1 ? 1 : null,
        invoiceUrl: fakePaymentPageUrl(paymentId),
        bankSlipUrl: input.method === "BOLETO" ? fakePaymentPageUrl(paymentId) : null,
        paidDate: null,
        refundDenied: false,
      };
    },

    async getPixQrCode(paymentId) {
      return {
        payload: `00020126580014br.gov.bcb.pix-SIMULADO-${paymentId}`,
        imageDataUrl: `data:image/svg+xml;base64,${Buffer.from(FAKE_QR_SVG).toString("base64")}`,
      };
    },

    async getCharge() {
      throw new PaymentProviderError("No modo simulado, a situação da cobrança muda pela página /dev/pagamentos.");
    },

    async refundCharge() {
      // Nada a fazer: o estorno "chega" quando você clica em "Concluir estorno" na página
      // /dev/pagamentos (como o aviso do Asaas, que chega depois).
    },

    async createSubscription(input) {
      const subscriptionId = fakeId("sub");
      const paymentId = fakeId("pay");
      return {
        subscriptionId,
        firstCharge: {
          paymentId,
          installmentId: null,
          subscriptionId,
          externalReference: input.externalReference,
          method: input.method,
          status: "PENDING",
          providerStatus: "PENDING",
          valueCents: input.valueCents,
          dueDate: input.nextDueDate,
          installmentNumber: null,
          invoiceUrl: fakePaymentPageUrl(paymentId),
          bankSlipUrl: input.method === "BOLETO" ? fakePaymentPageUrl(paymentId) : null,
          paidDate: null,
          refundDenied: false,
        },
      };
    },

    async cancelSubscription() {
      // Nada a fazer no modo simulado.
    },

    async scheduleInvoice() {
      // A nota simulada já nasce "emitida" (sem valor fiscal, claro).
      return {
        invoiceId: fakeId("inv"),
        status: "AUTHORIZED",
        number: `SIM-${Date.now().toString().slice(-6)}`,
        pdfUrl: null,
        xmlUrl: null,
        statusDescription: "Nota simulada (desenvolvimento), sem valor fiscal.",
      };
    },

    async cancelInvoice() {
      // No modo simulado, o cancelamento é imediato.
      return { status: "CANCELED" as const };
    },
  };
}
