"use client";

/**
 * answer-choices.tsx — As opções de resposta como botões de rádio: alternativas A–E ou
 * Certo/Errado.
 *
 * Quem chama: o cartão da questão (Resolver questões) e a tela do simulado.
 * As opções vêm de `choicesFor` (`answers.ts`).
 * Depois de corrigido (`result`), pinta a certa de verde e a marcada errada de vermelho.
 */
import { cn } from "@/lib/utils";

import type { Choice } from "../answers";

type AnswerChoicesProps = {
  name: string;
  choices: Choice[];
  selected: string | null;
  onSelect?: (value: string) => void;
  disabled?: boolean;
  // Depois da correção: qual é a certa (e a marcada fica vermelha se for outra).
  correctAnswer?: string | null;
  legend: string;
};

export function AnswerChoices({ name, choices, selected, onSelect, disabled, correctAnswer, legend }: AnswerChoicesProps) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      {choices.map((choice) => {
        const isSelected = selected === choice.value;
        const isRight = correctAnswer != null && choice.value === correctAnswer;
        const isWrongPick = correctAnswer != null && isSelected && !isRight;
        return (
          <label
            key={choice.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors",
              "has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2",
              isSelected && correctAnswer == null && "border-primary bg-primary/5",
              isRight && "border-green-600 bg-green-50 dark:bg-green-950/40",
              isWrongPick && "border-red-600 bg-red-50 dark:bg-red-950/40",
              disabled && "cursor-default",
            )}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={isSelected}
              onChange={() => onSelect?.(choice.value)}
              className="mt-0.5"
            />
            <span className="font-semibold">{choice.label}</span>
            {choice.text ? <span className="whitespace-pre-line">{choice.text}</span> : null}
            {isRight ? <span className="ml-auto text-xs font-medium text-green-700 dark:text-green-400">Gabarito</span> : null}
          </label>
        );
      })}
    </fieldset>
  );
}
