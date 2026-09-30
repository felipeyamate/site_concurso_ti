/**
 * types.ts — O "contrato" do provedor de pagamento (quem cobra de verdade).
 *
 * Quem usa: o checkout, os reembolsos, as assinaturas e as notas fiscais só conversam com este
 * contrato. Hoje há duas implementações:
 *  - `asaas/asaas-provider.ts`: o Asaas (Pix, boleto, cartão, assinaturas, NFS-e);
 *  - `fake/fake-provider.ts`: um provedor SIMULADO, só para desenvolvimento (sem conta no Asaas).
 *
 * Princípio de troca de fornecedor (PROJECT.md, seção 4): se um dia trocarmos o Asaas, só uma
 * implementação nova muda — o resto do app continua igual.
 * Paralelo em Python: uma classe abstrata (`abc.ABC`) com uma subclasse por fornecedor.
 *
 * Todos os valores aqui já estão no NOSSO formato: dinheiro em centavos, datas "AAAA-MM-DD",
 * status com os nomes do nosso banco (cada implementação traduz os do fornecedor).
 */
import type { FiscalInvoiceStatus, PaymentMethod, PaymentProviderKind, PaymentStatus, PlanCycle } from "@/generated/prisma/enums";

import type { DateOnly } from "../dates";

export type ProviderCustomerInput = {
  userId: string;
  name: string;
  email: string;
  cpf: string; // só dígitos
  phone: string | null; // só dígitos
};

export type ProviderChargeInput = {
  customerId: string;
  method: PaymentMethod;
  valueCents: number; // valor TOTAL (no parcelado, o provedor divide)
  installments: number; // 1 = à vista (parcelas só no cartão)
  dueDate: DateOnly;
  description: string;
  externalReference: string; // o ID do nosso pedido
  successUrl: string | null; // para onde o provedor manda o aluno depois de pagar (cartão)
};

// Uma cobrança criada/consultada no provedor, já traduzida.
export type ProviderCharge = {
  paymentId: string;
  installmentId: string | null;
  subscriptionId: string | null;
  externalReference: string | null;
  method: PaymentMethod | null;
  status: PaymentStatus;
  providerStatus: string;
  valueCents: number;
  dueDate: DateOnly | null;
  installmentNumber: number | null;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  // Dia em que foi paga, segundo o provedor (aprovação do cartão; dia do Pix/boleto). Usado quando
  // descobrimos o pagamento SEM aviso (ex.: "Conferir no Asaas"), para não usar a hora do clique.
  paidDate: DateOnly | null;
  // O provedor NEGOU um estorno pedido (a cobrança voltou a paga). É a resposta ao NOSSO pedido
  // de estorno, então vale mesmo que o horário do aviso empate com o do pedido (relógios diferentes).
  refundDenied: boolean;
};

export type ProviderSubscriptionInput = {
  customerId: string;
  method: PaymentMethod;
  valueCents: number;
  cycle: PlanCycle;
  nextDueDate: DateOnly; // vencimento da 1ª cobrança
  description: string;
  externalReference: string; // o ID da nossa assinatura
  successUrl: string | null;
};

export type ProviderPixQrCode = {
  payload: string; // o "copia e cola"
  imageDataUrl: string; // a imagem do QR Code, pronta para um <img src>
};

export type ProviderInvoiceInput = {
  paymentId: string; // cobrança no provedor
  valueCents: number;
  effectiveDate: DateOnly;
  serviceDescription: string;
  observations: string;
  municipalServiceId: string | null;
  municipalServiceCode: string | null;
  municipalServiceName: string;
  issRate: number; // em %
  externalReference: string;
};

export type ProviderInvoice = {
  invoiceId: string;
  status: FiscalInvoiceStatus;
  number: string | null;
  pdfUrl: string | null;
  xmlUrl: string | null;
  statusDescription: string | null;
};

export interface PaymentProvider {
  readonly kind: PaymentProviderKind;

  /** Cadastra o aluno como cliente no provedor (necessário antes de cobrar). */
  createCustomer(input: ProviderCustomerInput): Promise<{ customerId: string }>;

  /** Cria uma cobrança avulsa (ou parcelada no cartão). */
  createCharge(input: ProviderChargeInput): Promise<ProviderCharge>;

  /** QR Code e "copia e cola" do Pix de uma cobrança. */
  getPixQrCode(paymentId: string): Promise<ProviderPixQrCode>;

  /** Situação ATUAL de uma cobrança (para conferir quando um aviso se perdeu). */
  getCharge(paymentId: string): Promise<ProviderCharge>;

  /** Estorna uma cobrança (ou o parcelamento inteiro). A confirmação chega depois, por aviso. */
  refundCharge(params: { paymentId: string; installmentId: string | null }): Promise<void>;

  /** Cria uma assinatura e devolve a 1ª cobrança (se o provedor já a tiver gerado). */
  createSubscription(input: ProviderSubscriptionInput): Promise<{ subscriptionId: string; firstCharge: ProviderCharge | null }>;

  /** Cancela a assinatura (não gera novas cobranças). */
  cancelSubscription(subscriptionId: string): Promise<void>;

  /** Agenda a nota fiscal (NFS-e) de uma cobrança paga. */
  scheduleInvoice(input: ProviderInvoiceInput): Promise<ProviderInvoice>;

  /**
   * Pede o cancelamento de uma nota fiscal (ex.: depois de um reembolso). Devolve a situação: já
   * cancelada, ou "cancelamento em andamento" (a prefeitura responde depois, por aviso).
   */
  cancelInvoice(invoiceId: string): Promise<{ status: "CANCELED" | "PROCESSING_CANCELLATION" }>;
}

/** Erro "esperado" do provedor, com uma mensagem que pode ir para a tela. */
export class PaymentProviderError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "PaymentProviderError";
    this.status = status;
  }
}

/** Texto de um erro do provedor para mostrar ao usuário (erros inesperados viram uma frase genérica). */
export function providerErrorMessage(error: unknown): string {
  return error instanceof PaymentProviderError ? error.message : "o provedor de pagamento não respondeu.";
}
