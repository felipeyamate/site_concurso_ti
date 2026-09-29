/**
 * provider.server.ts — Escolhe o provedor de pagamento conforme as variáveis de ambiente.
 *
 * Quem chama: o checkout, reembolsos, assinaturas, notas fiscais e o painel (situação das vendas).
 *
 * Regras (uma só, aqui):
 *  - Com ASAAS_API_KEY → Asaas (sandbox ou produção, conforme ASAAS_ENVIRONMENT).
 *    Exceção de segurança: o SITE DE PRODUÇÃO com a chave do SANDBOX fica com as vendas
 *    desligadas — no sandbox, cartões de teste "pagam" de mentira e liberariam acesso de graça.
 *  - Sem a chave, fora de produção → provedor SIMULADO (para testar tudo sem conta).
 *  - Sem a chave, em produção → vendas desligadas (com aviso no painel).
 */
import "server-only";

import type { PaymentProviderKind } from "@/generated/prisma/enums";
import { env } from "@/lib/env";
import { isProductionSite } from "@/lib/runtime";

import { createAsaasProvider } from "./asaas/asaas-provider";
import { createFakeProvider } from "./fake/fake-provider";
import type { PaymentProvider } from "./types";

export type PaymentsSetup =
  | { enabled: true; kind: "ASAAS"; environment: "sandbox" | "production" }
  | { enabled: true; kind: "FAKE" }
  | { enabled: false; problem: string };

/** Situação das vendas (o painel mostra; nunca inclui o valor das chaves). */
export function getPaymentsSetup(): PaymentsSetup {
  if (env.ASAAS_API_KEY) {
    if (isProductionSite() && env.ASAAS_ENVIRONMENT === "sandbox") {
      return {
        enabled: false,
        problem:
          "O site de produção está com a chave do SANDBOX do Asaas: vendas desligadas (no sandbox, pagamentos de teste liberariam acesso de graça). Use a chave de produção e ASAAS_ENVIRONMENT=production.",
      };
    }
    return { enabled: true, kind: "ASAAS", environment: env.ASAAS_ENVIRONMENT };
  }
  if (env.NODE_ENV !== "production") {
    return { enabled: true, kind: "FAKE" };
  }
  return { enabled: false, problem: "ASAAS_API_KEY não configurada: as vendas estão desligadas." };
}

// Criados uma vez só (e só quando usados).
let asaasProvider: PaymentProvider | null = null;
let fakeProvider: PaymentProvider | null = null;

function providerFor(kind: PaymentProviderKind): PaymentProvider {
  if (kind === "ASAAS") {
    if (!env.ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada.");
    asaasProvider ??= createAsaasProvider({ apiKey: env.ASAAS_API_KEY, environment: env.ASAAS_ENVIRONMENT });
    return asaasProvider;
  }
  fakeProvider ??= createFakeProvider();
  return fakeProvider;
}

/** O provedor para NOVAS vendas, ou `null` se as vendas estão desligadas. */
export function getPaymentProvider(): PaymentProvider | null {
  const setup = getPaymentsSetup();
  return setup.enabled ? providerFor(setup.kind) : null;
}

/**
 * O provedor que criou uma cobrança/pedido JÁ EXISTENTE (para reembolsar, cancelar, emitir nota).
 * `null` se ele não está mais disponível (ex.: um pedido simulado quando o site já usa o Asaas).
 */
export function getProviderForRecord(kind: PaymentProviderKind): PaymentProvider | null {
  const setup = getPaymentsSetup();
  if (setup.enabled && setup.kind === kind) return providerFor(kind);
  // Pedidos simulados continuam "reembolsáveis" em desenvolvimento, mesmo com o Asaas ligado.
  if (kind === "FAKE" && env.NODE_ENV !== "production") return providerFor("FAKE");
  return null;
}
