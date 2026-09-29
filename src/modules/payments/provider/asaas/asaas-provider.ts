/**
 * asaas-provider.ts — O provedor de pagamento REAL: Asaas (Pix, boleto, cartão, assinatura, NFS-e).
 *
 * Quem chama: `provider.server.ts` (que escolhe o provedor conforme as variáveis de ambiente).
 * Implementa o contrato `PaymentProvider` (`../types.ts`) usando a API v3 do Asaas.
 *
 * Decisões importantes:
 *  - Cartão: o aluno paga na PÁGINA DO ASAAS (`invoiceUrl`). Os dados do cartão nunca passam pelo
 *    nosso servidor (menos risco e nenhuma exigência de certificação de segurança de cartões).
 *  - Pix: mostramos o QR Code na nossa página (`getPixQrCode`); boleto: link para o PDF do Asaas.
 *  - Nada aqui libera acesso: quem confirma o pagamento é o AVISO (webhook) do Asaas.
 */
import "server-only";

import { z } from "zod";

import { centsToReais } from "../../money";
import {
  PaymentProviderError,
  type PaymentProvider,
  type ProviderCharge,
  type ProviderChargeInput,
  type ProviderSubscriptionInput,
} from "../types";
import { createAsaasClient, type AsaasClient, type AsaasEnvironment } from "./client";
import { asaasInvoiceSchema, asaasPaymentSchema, toProviderCharge, toProviderInvoice } from "./mapping";

const customerResponseSchema = z.object({ id: z.string().min(1) });
const subscriptionResponseSchema = z.object({ id: z.string().min(1) });
const pixQrCodeSchema = z.object({ encodedImage: z.string().min(1), payload: z.string().min(1) });
const paymentListSchema = z.object({ data: z.array(asaasPaymentSchema) });

/** Confere a resposta do Asaas; se vier num formato inesperado, erro claro (em vez de `undefined`). */
function parseResponse<T>(schema: z.ZodType<T>, data: unknown, what: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new PaymentProviderError(`Resposta inesperada do Asaas ao ${what}.`);
  }
  return result.data;
}

// "callback" = para onde o Asaas manda o aluno depois de pagar com cartão. O Asaas só aceita
// endereços do domínio cadastrado na conta; sem endereço (ex.: em localhost), não enviamos.
function callbackFor(successUrl: string | null) {
  return successUrl ? { callback: { successUrl, autoRedirect: true } } : {};
}

export function createAsaasProvider(options: {
  apiKey: string;
  environment: AsaasEnvironment;
  fetchImpl?: typeof fetch;
}): PaymentProvider {
  const client: AsaasClient = createAsaasClient(options);

  return {
    kind: "ASAAS",

    async createCustomer(input) {
      const data = await client.request("POST", "/customers", {
        name: input.name,
        cpfCnpj: input.cpf,
        email: input.email,
        ...(input.phone ? { mobilePhone: input.phone } : {}),
        // O ID do aluno no nosso site: facilita achar o cliente no painel do Asaas.
        externalReference: input.userId,
      });
      return { customerId: parseResponse(customerResponseSchema, data, "cadastrar o cliente").id };
    },

    async createCharge(input: ProviderChargeInput): Promise<ProviderCharge> {
      // Parcelado (só cartão): manda o TOTAL e o número de parcelas; o Asaas divide e ajusta os
      // centavos na última parcela. À vista: manda o valor.
      const amount =
        input.installments > 1
          ? { installmentCount: input.installments, totalValue: centsToReais(input.valueCents) }
          : { value: centsToReais(input.valueCents) };
      const data = await client.request("POST", "/payments", {
        customer: input.customerId,
        billingType: input.method,
        dueDate: input.dueDate,
        description: input.description,
        externalReference: input.externalReference,
        ...amount,
        ...callbackFor(input.successUrl),
      });
      return toProviderCharge(parseResponse(asaasPaymentSchema, data, "criar a cobrança"));
    },

    async getPixQrCode(paymentId) {
      const data = await client.request("GET", `/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
      const qr = parseResponse(pixQrCodeSchema, data, "buscar o QR Code do Pix");
      return { payload: qr.payload, imageDataUrl: `data:image/png;base64,${qr.encodedImage}` };
    },

    async getCharge(paymentId) {
      const data = await client.request("GET", `/payments/${encodeURIComponent(paymentId)}`);
      return toProviderCharge(parseResponse(asaasPaymentSchema, data, "consultar a cobrança"));
    },

    async refundCharge({ paymentId, installmentId }) {
      // Parcelado no cartão: estorna o parcelamento inteiro (todas as parcelas de uma vez).
      const path = installmentId
        ? `/installments/${encodeURIComponent(installmentId)}/refund`
        : `/payments/${encodeURIComponent(paymentId)}/refund`;
      await client.request("POST", path, {});
    },

    async createSubscription(input: ProviderSubscriptionInput) {
      const data = await client.request("POST", "/subscriptions", {
        customer: input.customerId,
        billingType: input.method,
        value: centsToReais(input.valueCents),
        nextDueDate: input.nextDueDate,
        cycle: input.cycle,
        description: input.description,
        externalReference: input.externalReference,
        ...callbackFor(input.successUrl),
      });
      const subscriptionId = parseResponse(subscriptionResponseSchema, data, "criar a assinatura").id;

      // A 1ª cobrança costuma ser gerada na hora; se ainda não estiver lá, ela chega por aviso
      // (PAYMENT_CREATED) e a página de pagamento mostra "gerando a cobrança...".
      const list = await client.request("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`);
      const payments = parseResponse(paymentListSchema, list, "buscar a 1ª cobrança da assinatura").data;
      const first = payments.find((payment) => !payment.deleted);
      return { subscriptionId, firstCharge: first ? toProviderCharge(first) : null };
    },

    async cancelSubscription(subscriptionId) {
      await client.request("DELETE", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
    },

    async scheduleInvoice(input) {
      const data = await client.request("POST", "/invoices", {
        payment: input.paymentId,
        serviceDescription: input.serviceDescription,
        observations: input.observations,
        externalReference: input.externalReference,
        value: centsToReais(input.valueCents),
        deductions: 0,
        effectiveDate: input.effectiveDate,
        ...(input.municipalServiceId ? { municipalServiceId: input.municipalServiceId } : {}),
        ...(input.municipalServiceCode ? { municipalServiceCode: input.municipalServiceCode } : {}),
        municipalServiceName: input.municipalServiceName,
        // Impostos: só o ISS (alíquota do município), sem retenção. Os demais ficam zerados —
        // o comum para quem é do Simples Nacional. Confirme com o seu contador (README).
        taxes: { retainIss: false, iss: input.issRate, pis: 0, cofins: 0, csll: 0, inss: 0, ir: 0 },
      });
      return toProviderInvoice(parseResponse(asaasInvoiceSchema, data, "agendar a nota fiscal"));
    },

    async cancelInvoice(invoiceId) {
      await client.request("POST", `/invoices/${encodeURIComponent(invoiceId)}/cancel`, {});
    },
  };
}
