/**
 * money.ts — Dinheiro: formatar, converter e calcular parcelas.
 *
 * Quem chama: telas de venda (preços, parcelas), o painel (formulários de preço) e o provedor de
 * pagamento (o Asaas recebe e devolve valores em REAIS, com casas decimais).
 *
 * Por que centavos (número inteiro) no nosso lado: 0.1 + 0.2 = 0.30000000000000004 em
 * JavaScript (e em Python também!). Contando em centavos, R$ 97,90 = 9790 e a conta é exata —
 * como usar `Decimal` em vez de `float` no Python.
 *
 * Arquivo "puro" (sem banco, sem rede), testado em `money.test.ts`.
 */

// Menor parcela aceita no cartão (limite do Asaas: R$ 5,00).
export const MIN_INSTALLMENT_CENTS = 500;
// Menor valor de uma cobrança (limite do Asaas: R$ 5,00). Um cupom não pode deixar o preço abaixo disto.
export const MIN_CHARGE_CENTS = 500;
// Máximo de parcelas que oferecemos (o banco também garante: 1 a 12).
export const MAX_INSTALLMENTS = 12;

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 9790 → "R$ 97,90". */
export function formatBRL(cents: number): string {
  // O Intl usa um espaço "especial" (não quebrável) entre "R$" e o número; trocamos por um
  // espaço comum para os textos ficarem previsíveis (e iguais nos testes).
  return brlFormatter.format(cents / 100).replace(/\s/g, " ");
}

/** 9790 → 97.9 (formato do Asaas). Arredonda em 2 casas para evitar sobras como 97.900000001. */
export function centsToReais(cents: number): number {
  return Math.round(cents) / 100;
}

/** 97.9 (vindo do Asaas) → 9790. */
export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Lê um preço digitado no painel e devolve centavos (ou `null` se não entendeu).
 * Aceita "97,90", "97.90", "1.234,56", "R$ 1.234,56", "97" e "97,9".
 * Regras: o ÚLTIMO separador seguido de 1 ou 2 dígitos é o dos centavos; os de milhar separam
 * grupos de exatamente 3 dígitos (e são diferentes do separador dos centavos). "10,5,3" é recusado.
 */
export function parseBRLInput(text: string): number | null {
  const cleaned = text.replace(/R\$|\s/g, "");
  if (!/^\d[\d.,]*$/.test(cleaned)) return null;

  const decimalMatch = cleaned.match(/[.,](\d{1,2})$/);
  const decimalSeparator = decimalMatch ? cleaned[decimalMatch.index ?? 0] : null;
  const integerRaw = decimalMatch ? cleaned.slice(0, decimalMatch.index) : cleaned;
  if (!/^\d+$/.test(integerRaw)) {
    // Com separador de milhar: "1.234" ou "1.234.567" (sempre o mesmo separador).
    const thousands = integerRaw.match(/^\d{1,3}([.,])\d{3}(?:\1\d{3})*$/);
    if (!thousands || thousands[1] === decimalSeparator) return null;
  }
  const integerPart = integerRaw.replace(/[.,]/g, "");
  const centsPart = decimalMatch ? decimalMatch[1].padEnd(2, "0") : "00";

  const cents = Number(integerPart) * 100 + Number(centsPart);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** 9790 → "97,90" (para preencher o campo de preço no painel). */
export function formatCentsForInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export type InstallmentOption = { count: number; valueCents: number };

/**
 * Parcelas oferecidas no cartão, sem juros: de 1x até `maxInstallments`, parando quando a parcela
 * ficaria menor que R$ 5,00. O valor mostrado é o da parcela arredondado para cima (o provedor
 * ajusta a diferença de centavos na última parcela).
 * Ex.: R$ 100,00 em até 3x → [1x R$ 100,00, 2x R$ 50,00, 3x R$ 33,34].
 */
export function installmentOptions(priceCents: number, maxInstallments: number): InstallmentOption[] {
  const limit = Math.min(Math.max(1, Math.floor(maxInstallments)), MAX_INSTALLMENTS);
  const options: InstallmentOption[] = [];
  for (let count = 1; count <= limit; count += 1) {
    const valueCents = Math.ceil(priceCents / count);
    if (count > 1 && Math.floor(priceCents / count) < MIN_INSTALLMENT_CENTS) break;
    options.push({ count, valueCents });
  }
  return options;
}
