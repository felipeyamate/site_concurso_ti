/**
 * cpf.ts — CPF: limpar, validar (dígitos verificadores) e mostrar.
 *
 * Quem chama: o checkout (o Asaas exige CPF para gerar cobranças e notas fiscais) e as telas que
 * mostram o CPF (sempre parcialmente escondido).
 *
 * Arquivo "puro", testado em `cpf.test.ts`.
 */

/** Deixa só os dígitos: "123.456.789-09" → "12345678909". */
export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * O CPF é válido? Confere o formato e os 2 dígitos verificadores (o "módulo 11" da Receita).
 *
 * Passos:
 *  1. Precisa ter 11 dígitos, e não pode ser tudo igual (111.111.111-11 passa na conta, mas não existe).
 *  2. 1º dígito: soma dos 9 primeiros × pesos 10..2; resto da divisão por 11; <2 → 0, senão 11 − resto.
 *  3. 2º dígito: a mesma conta com os 10 primeiros e pesos 11..2.
 */
export function isValidCpf(value: string): boolean {
  const digits = normalizeCpf(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const numbers = Array.from(digits, Number);
  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += numbers[index] * (length + 1 - index);
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return checkDigit(9) === numbers[9] && checkDigit(10) === numbers[10];
}

/** "12345678909" → "123.456.789-09". */
export function formatCpf(value: string): string {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Mostra só o meio (LGPD: não exibir o CPF inteiro): "12345678909" → "***.456.789-**". */
export function maskCpf(value: string): string {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return "***";
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}
