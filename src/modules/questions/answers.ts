/**
 * answers.ts — Regras das respostas: quais letras valem em cada tipo de questão, se a questão
 * está bem montada (alternativas + gabarito) e como mostrar uma resposta na tela.
 *
 * Quem chama: o painel (ao salvar uma questão), a importação por planilha, a ação de responder
 * e o simulado.
 *
 * Tipos de questão:
 *  - MULTIPLE_CHOICE: alternativas A, B, C... (de 2 a 5, sempre em sequência a partir do A).
 *  - TRUE_FALSE (estilo Cebraspe): o aluno julga a afirmação — "C" (certo) ou "E" (errado).
 *
 * Arquivo "puro", testado em `answers.test.ts`.
 */
import type { QuestionType } from "@/generated/prisma/enums";

export const OPTION_LABELS = ["A", "B", "C", "D", "E"] as const;
export type OptionLabel = (typeof OPTION_LABELS)[number];

export const TRUE_FALSE_ANSWERS = ["C", "E"] as const;

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = OPTION_LABELS.length;

/**
 * A resposta vale para esta questão?
 * Múltipla escolha: uma das letras que a questão tem. Certo/Errado: "C" ou "E".
 */
export function isValidAnswer(type: QuestionType, answer: string, optionLabels: readonly string[]): boolean {
  if (type === "TRUE_FALSE") return (TRUE_FALSE_ANSWERS as readonly string[]).includes(answer);
  return optionLabels.includes(answer);
}

/** A resposta está certa? (Comparação exata: "A" é diferente de "a" — quem chama normaliza.) */
export function isCorrectAnswer(correctAnswer: string, answer: string): boolean {
  return correctAnswer === answer;
}

/** Como mostrar uma resposta: "Certo"/"Errado" no Certo/Errado; a própria letra na múltipla escolha. */
export function answerLabel(type: QuestionType, answer: string): string {
  if (type === "TRUE_FALSE") return answer === "C" ? "Certo" : answer === "E" ? "Errado" : answer;
  return answer;
}

/** Uma opção de resposta como aparece na tela (valor gravado, rótulo e texto da alternativa). */
export type Choice = { value: string; label: string; text: string | null };

/**
 * As opções de uma questão: as alternativas dela, ou Certo/Errado.
 * Fica aqui (arquivo puro) e não no componente: a tela do resultado do simulado é montada no
 * servidor, e uma função de um arquivo "use client" não pode ser chamada pelo servidor.
 */
export function choicesFor(type: QuestionType, options: Array<{ label: string; text: string }>): Choice[] {
  if (type === "TRUE_FALSE") {
    return [
      { value: "C", label: "Certo", text: null },
      { value: "E", label: "Errado", text: null },
    ];
  }
  return options.map((option) => ({ value: option.label, label: option.label, text: option.text }));
}

export type QuestionContent = {
  type: QuestionType;
  options: Array<{ label: string; text: string }>;
  correctAnswer: string;
};

/**
 * Confere se a questão está bem montada. Devolve a lista de problemas (vazia = tudo certo),
 * em frases que vão direto para a tela do professor (e para os erros da importação).
 *
 * Passos:
 *  1. Certo/Errado: não tem alternativas; gabarito "C" ou "E".
 *  2. Múltipla escolha: de 2 a 5 alternativas, com as letras em sequência a partir do A
 *     (A, B, C... sem pular), todas com texto, e o gabarito é uma delas.
 */
export function validateQuestionContent(content: QuestionContent): string[] {
  const problems: string[] = [];
  if (content.type === "TRUE_FALSE") {
    if (content.options.length > 0) problems.push("Questão de Certo/Errado não tem alternativas.");
    if (!(TRUE_FALSE_ANSWERS as readonly string[]).includes(content.correctAnswer)) {
      problems.push('Gabarito de Certo/Errado deve ser "C" (certo) ou "E" (errado).');
    }
    return problems;
  }

  const labels = content.options.map((option) => option.label);
  if (labels.length < MIN_OPTIONS || labels.length > MAX_OPTIONS) {
    problems.push(`A questão precisa ter de ${MIN_OPTIONS} a ${MAX_OPTIONS} alternativas.`);
  }
  const expected = OPTION_LABELS.slice(0, labels.length);
  if (labels.some((label, index) => label !== expected[index])) {
    problems.push("As alternativas devem seguir a ordem A, B, C... sem pular letras.");
  }
  for (const option of content.options) {
    if (option.text.trim().length === 0) {
      problems.push(`Alternativa ${option.label} sem texto (as alternativas seguem a ordem A, B, C... sem pular).`);
    }
  }
  if (!labels.includes(content.correctAnswer)) {
    problems.push("O gabarito precisa ser uma das alternativas.");
  }
  return problems;
}
