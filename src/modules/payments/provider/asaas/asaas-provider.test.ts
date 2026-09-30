/**
 * asaas-provider.test.ts — Testes do provedor Asaas com um `fetch` FALSO (nenhuma chamada real):
 * conferimos o que seria enviado à API e como a resposta é traduzida.
 * Rodar: npm test
 */
import { describe, expect, it, vi } from "vitest";

import { PaymentProviderError } from "../types";
import { createAsaasProvider } from "./asaas-provider";

type Recorded = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** `fetch` falso: grava cada requisição e responde com a próxima resposta da fila. */
function fakeFetch(responses: Array<{ status?: number; body: unknown }>) {
  const requests: Recorded[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(url),
      method: init?.method ?? "GET",
      headers: init?.headers as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const next = responses.shift() ?? { body: {} };
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

const payment = {
  object: "payment",
  id: "pay_123",
  status: "PENDING",
  billingType: "PIX",
  value: 97.9,
  dueDate: "2026-09-30",
  invoiceUrl: "https://sandbox.asaas.com/i/123",
  externalReference: "pedido-1",
};

describe("createAsaasProvider", () => {
  it("usa o endereço do sandbox e a chave no cabeçalho access_token", async () => {
    const { fetchImpl, requests } = fakeFetch([{ body: { id: "cus_1" } }]);
    const provider = createAsaasProvider({ apiKey: "$aact_chave", environment: "sandbox", fetchImpl });
    const result = await provider.createCustomer({
      userId: "user-1",
      name: "Maria",
      email: "maria@exemplo.com",
      cpf: "52998224725",
      phone: null,
    });
    expect(result).toEqual({ customerId: "cus_1" });
    expect(requests[0]).toMatchObject({
      url: "https://api-sandbox.asaas.com/v3/customers",
      method: "POST",
      headers: { access_token: "$aact_chave" },
      body: { name: "Maria", cpfCnpj: "52998224725", email: "maria@exemplo.com", externalReference: "user-1" },
    });
  });

  it("produção usa api.asaas.com", async () => {
    const { fetchImpl, requests } = fakeFetch([{ body: payment }]);
    await createAsaasProvider({ apiKey: "k", environment: "production", fetchImpl }).getCharge("pay_123");
    expect(requests[0].url).toBe("https://api.asaas.com/v3/payments/pay_123");
  });

  it("cobrança à vista manda o valor em reais; parcelada manda o total e as parcelas", async () => {
    const { fetchImpl, requests } = fakeFetch([{ body: payment }, { body: { ...payment, installment: "ins_1" } }]);
    const provider = createAsaasProvider({ apiKey: "k", environment: "sandbox", fetchImpl });
    const base = {
      customerId: "cus_1",
      dueDate: "2026-09-30",
      description: "Curso",
      externalReference: "pedido-1",
      successUrl: null,
    };
    const charge = await provider.createCharge({ ...base, method: "PIX", valueCents: 9790, installments: 1 });
    expect(requests[0].body).toEqual({
      customer: "cus_1",
      billingType: "PIX",
      dueDate: "2026-09-30",
      description: "Curso",
      externalReference: "pedido-1",
      value: 97.9,
    });
    expect(charge).toMatchObject({ paymentId: "pay_123", status: "PENDING", valueCents: 9790, method: "PIX" });

    const installment = await provider.createCharge({
      ...base,
      method: "CREDIT_CARD",
      valueCents: 29700,
      installments: 3,
      successUrl: "https://meusite.com.br/area-do-aluno/compras",
    });
    expect(requests[1].body).toMatchObject({
      billingType: "CREDIT_CARD",
      installmentCount: 3,
      totalValue: 297,
      callback: { successUrl: "https://meusite.com.br/area-do-aluno/compras", autoRedirect: true },
    });
    expect(requests[1].body).not.toHaveProperty("value");
    expect(installment.installmentId).toBe("ins_1");
  });

  it("Pix: devolve o copia e cola e a imagem pronta para <img>", async () => {
    const { fetchImpl, requests } = fakeFetch([{ body: { encodedImage: "iVBORw0KGgo", payload: "00020126..." } }]);
    const qr = await createAsaasProvider({ apiKey: "k", environment: "sandbox", fetchImpl }).getPixQrCode("pay_123");
    expect(requests[0].url).toBe("https://api-sandbox.asaas.com/v3/payments/pay_123/pixQrCode");
    expect(qr).toEqual({ payload: "00020126...", imageDataUrl: "data:image/png;base64,iVBORw0KGgo" });
  });

  it("estorno: parcelado estorna o parcelamento inteiro", async () => {
    const { fetchImpl, requests } = fakeFetch([{ body: {} }, { body: {} }]);
    const provider = createAsaasProvider({ apiKey: "k", environment: "sandbox", fetchImpl });
    await provider.refundCharge({ paymentId: "pay_1", installmentId: null });
    await provider.refundCharge({ paymentId: "pay_1", installmentId: "ins_9" });
    expect(requests.map((request) => request.url)).toEqual([
      "https://api-sandbox.asaas.com/v3/payments/pay_1/refund",
      "https://api-sandbox.asaas.com/v3/installments/ins_9/refund",
    ]);
  });

  it("assinatura: cria e já busca a 1ª cobrança", async () => {
    const { fetchImpl, requests } = fakeFetch([
      { body: { id: "sub_1" } },
      { body: { data: [{ ...payment, id: "pay_first", subscription: "sub_1" }] } },
    ]);
    const result = await createAsaasProvider({ apiKey: "k", environment: "sandbox", fetchImpl }).createSubscription({
      customerId: "cus_1",
      method: "CREDIT_CARD",
      valueCents: 4990,
      cycle: "MONTHLY",
      nextDueDate: "2026-09-29",
      description: "Assinatura mensal",
      externalReference: "assinatura-1",
      successUrl: null,
    });
    expect(requests[0].body).toMatchObject({ value: 49.9, cycle: "MONTHLY", nextDueDate: "2026-09-29" });
    expect(requests[1].url).toBe("https://api-sandbox.asaas.com/v3/subscriptions/sub_1/payments");
    expect(result.subscriptionId).toBe("sub_1");
    expect(result.firstCharge).toMatchObject({ paymentId: "pay_first", subscriptionId: "sub_1" });
  });

  it("assinatura criada, mas a busca da 1ª cobrança falha: NÃO vira erro (a assinatura já existe no Asaas)", async () => {
    const { fetchImpl } = fakeFetch([{ body: { id: "sub_2" } }, { status: 500, body: { errors: [{ description: "instável" }] } }]);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await createAsaasProvider({ apiKey: "k", environment: "sandbox", fetchImpl }).createSubscription({
      customerId: "cus_1",
      method: "PIX",
      valueCents: 4990,
      cycle: "MONTHLY",
      nextDueDate: "2026-09-29",
      description: "Assinatura mensal",
      externalReference: "assinatura-2",
      successUrl: null,
    });
    // O ID fica guardado (dá para cancelar); a cobrança chega depois pelo aviso.
    expect(result).toEqual({ subscriptionId: "sub_2", firstCharge: null });
    consoleError.mockRestore();
  });

  it("cancelar nota: devolve 'cancelada' só quando o Asaas diz; senão, cancelamento em andamento", async () => {
    const provider = (body: unknown) =>
      createAsaasProvider({ apiKey: "k", environment: "sandbox", fetchImpl: fakeFetch([{ body }]).fetchImpl });
    expect(await provider({ id: "inv_1", status: "CANCELED" }).cancelInvoice("inv_1")).toEqual({ status: "CANCELED" });
    expect(await provider({ id: "inv_1", status: "PROCESSING_CANCELLATION" }).cancelInvoice("inv_1")).toEqual({
      status: "PROCESSING_CANCELLATION",
    });
    expect(await provider({}).cancelInvoice("inv_1")).toEqual({ status: "PROCESSING_CANCELLATION" });
  });

  it("nota fiscal: manda o serviço municipal e só o ISS como imposto", async () => {
    const { fetchImpl, requests } = fakeFetch([{ body: { id: "inv_1", status: "SCHEDULED" } }]);
    const invoice = await createAsaasProvider({ apiKey: "k", environment: "sandbox", fetchImpl }).scheduleInvoice({
      paymentId: "pay_1",
      valueCents: 9790,
      effectiveDate: "2026-09-29",
      serviceDescription: "Curso online",
      observations: "Pedido 1",
      municipalServiceId: null,
      municipalServiceCode: "08.02",
      municipalServiceName: "Ensino",
      issRate: 2,
      externalReference: "pagamento-1",
    });
    expect(requests[0].body).toMatchObject({
      payment: "pay_1",
      value: 97.9,
      municipalServiceCode: "08.02",
      taxes: { retainIss: false, iss: 2, pis: 0, cofins: 0, csll: 0, inss: 0, ir: 0 },
    });
    expect(requests[0].body).not.toHaveProperty("municipalServiceId");
    expect(invoice).toMatchObject({ invoiceId: "inv_1", status: "SCHEDULED" });
  });

  it("erro do Asaas vira PaymentProviderError com a explicação dele", async () => {
    const { fetchImpl } = fakeFetch([
      { status: 400, body: { errors: [{ code: "invalid_cpfCnpj", description: "O CPF informado é inválido." }] } },
    ]);
    const provider = createAsaasProvider({ apiKey: "k", environment: "sandbox", fetchImpl });
    const error = await provider
      .createCustomer({ userId: "u", name: "n", email: "e@x.com", cpf: "1", phone: null })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PaymentProviderError);
    expect((error as PaymentProviderError).message).toBe("O CPF informado é inválido.");
    expect((error as PaymentProviderError).status).toBe(400);
  });

  it("resposta em formato inesperado vira erro claro", async () => {
    const { fetchImpl } = fakeFetch([{ body: { sem: "id" } }]);
    await expect(
      createAsaasProvider({ apiKey: "k", environment: "sandbox", fetchImpl }).getCharge("pay_1"),
    ).rejects.toThrow(/Resposta inesperada/);
  });
});
