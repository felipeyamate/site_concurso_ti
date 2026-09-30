"use client";

/**
 * question-card.tsx — Uma questão em "Resolver questões": escolher, responder e ver o comentário.
 *
 * Quem chama: a página /questoes.
 * O que recebe: enunciado e alternativas — SEM gabarito e SEM comentário. Os dois só chegam na
 * resposta da ação `answerQuestionAction`, depois que a tentativa é gravada.
 * "Tentar de novo" monta o formulário do zero (cada tentativa conta no desempenho).
 */
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { QuestionType } from "@/generated/prisma/enums";

import { answerQuestionAction, type AnswerState } from "../actions";
import { choicesFor } from "../answers";
import { AnswerChoices } from "./answer-choices";
import { QuestionMeta, type QuestionMetaData } from "./question-meta";

export type PracticeQuestion = QuestionMetaData & {
  id: string;
  type: QuestionType;
  options: Array<{ label: string; text: string }>;
  history: "CORRECT" | "WRONG" | null;
};

export function QuestionCard({ question, number }: { question: PracticeQuestion; number: number }) {
  // Trocar a `key` recria o formulário (limpa a escolha e o resultado) para tentar de novo.
  const [round, setRound] = useState(0);
  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <QuestionMeta question={question} number={number} />
        </div>
        {question.history ? (
          <p className="text-muted-foreground text-xs">
            {question.history === "CORRECT" ? "✓ Você já acertou esta questão." : "Você já errou esta questão — tente de novo."}
          </p>
        ) : null}
        <AnswerForm key={round} question={question} onRetry={() => setRound((value) => value + 1)} />
      </CardContent>
    </Card>
  );
}

function AnswerForm({ question, onRetry }: { question: PracticeQuestion; onRetry: () => void }) {
  const [state, dispatch, pending] = useActionState<AnswerState, FormData>(answerQuestionAction, { status: "idle" });
  const [selected, setSelected] = useState<string | null>(null);
  const answered = state.status === "answered";

  function submit() {
    if (!selected) return;
    const formData = new FormData();
    formData.set("questionId", question.id);
    formData.set("answer", selected);
    startTransition(() => dispatch(formData));
  }

  return (
    <div className="grid gap-3">
      <AnswerChoices
        name={`q-${question.id}`}
        legend="Alternativas"
        choices={choicesFor(question.type, question.options)}
        selected={answered ? state.answer : selected}
        onSelect={setSelected}
        disabled={answered || pending}
        correctAnswer={answered ? state.correctAnswer : null}
      />

      {state.status === "error" ? (
        <p role="alert" className="text-destructive text-sm">
          {state.message}{" "}
          {state.message.includes("grátis") ? (
            <Link href="/planos" className="underline">
              Ver planos
            </Link>
          ) : null}
        </p>
      ) : null}

      {answered ? (
        <div className="grid gap-2" role="status">
          <p className={state.isCorrect ? "font-semibold text-green-700 dark:text-green-400" : "font-semibold text-red-700 dark:text-red-400"}>
            {state.isCorrect ? "Você acertou!" : `Você errou. Gabarito: ${state.correctLabel}.`}
            {state.communityPercent !== null ? (
              <span className="text-muted-foreground ml-2 text-xs font-normal">{state.communityPercent}% dos alunos acertam esta questão na primeira tentativa.</span>
            ) : null}
          </p>
          <div className="bg-muted/50 rounded-md p-3 text-sm">
            <p className="mb-1 font-medium">Comentário do professor</p>
            <p className="whitespace-pre-line">{state.explanation}</p>
          </div>
          {state.remainingFree !== null ? (
            <p className="text-muted-foreground text-xs">
              {state.remainingFree === 1 ? "Resta 1 questão grátis hoje." : `Restam ${state.remainingFree} questões grátis hoje.`}
            </p>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <Button type="button" className="w-fit" onClick={submit} disabled={!selected || pending}>
          {pending ? "Enviando..." : "Responder"}
        </Button>
      )}
    </div>
  );
}
