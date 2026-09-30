/**
 * limits.ts — Tamanhos máximos dos textos de uma questão.
 *
 * Quem chama: o formulário do painel (`schemas.ts`) e a importação por planilha
 * (`import-questions.ts`) — os dois caminhos aceitam exatamente os mesmos limites.
 */
export const QUESTION_LIMITS = {
  code: 60,
  statement: 10_000,
  explanation: 10_000,
  option: 2_000,
} as const;
