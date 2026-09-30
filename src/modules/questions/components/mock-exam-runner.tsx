"use client";

/**
 * mock-exam-runner.tsx — A tela de fazer o simulado: todas as questões, o relógio e "Finalizar".
 *
 * Quem chama: /simulados/[id] enquanto o simulado não foi finalizado.
 * O que faz:
 *  - cada clique numa alternativa é salvo na hora (`saveMockAnswerAction`) — fechar a aba não
 *    perde nada; um erro ao salvar aparece embaixo da questão (e a marcação volta ao que estava);
 *  - com tempo de prova, mostra o relógio; quando zera, finaliza sozinho;
 *  - "Finalizar" pergunta antes se ainda há questões em branco.
 * Nada de gabarito aqui: a página só manda enunciado e alternativas até o fim.
 */
import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { FormStatus } from "@/components/admin/form-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { initialFormState } from "@/lib/form-state";

import { finishMockExamAction, saveMockAnswerAction } from "../actions";
import { choicesFor } from "../answers";
import { AnswerChoices } from "./answer-choices";
import { QuestionMeta, type QuestionMetaData } from "./question-meta";

type RunnerItem = {
  position: number;
  answer: string | null;
  question: QuestionMetaData & { id: string; options: Array<{ label: string; text: string }> };
};

type MockExamRunnerProps = {
  mockExamId: string;
  items: RunnerItem[];
  // Hora em que o tempo acaba (texto ISO) — null = sem limite.
  deadline: string | null;
  timeIsUp: boolean;
};

function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function MockExamRunner({ mockExamId, items, deadline, timeIsUp }: MockExamRunnerProps) {
  const [answers, setAnswers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(items.map((item) => [item.question.id, item.answer])),
  );
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [finishState, finishDispatch, finishing] = useActionState(finishMockExamAction, initialFormState);
  const [now, setNow] = useState(() => Date.now());
  const [expired, setExpired] = useState(timeIsUp);
  const autoFinished = useRef(false);

  const answeredCount = Object.values(answers).filter((answer) => answer !== null).length;
  const deadlineMs = deadline ? new Date(deadline).getTime() : null;

  function finish() {
    const formData = new FormData();
    formData.set("mockExamId", mockExamId);
    startTransition(() => finishDispatch(formData));
  }

  // Relógio: atualiza a cada segundo; quando zera, finaliza sozinho (uma vez só).
  useEffect(() => {
    if (deadlineMs === null) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadlineMs && !autoFinished.current) {
        autoFinished.current = true;
        setExpired(true);
        finish();
      }
    }, 1000);
    return () => window.clearInterval(timer);
    // `finish` só usa valores estáveis (ID e o dispatch do React).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineMs]);

  function select(questionId: string, value: string) {
    const previous = answers[questionId] ?? null;
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setSaveErrors((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    const formData = new FormData();
    formData.set("mockExamId", mockExamId);
    formData.set("questionId", questionId);
    formData.set("answer", value);
    startTransition(async () => {
      const result = await saveMockAnswerAction(formData);
      if (!result.ok) {
        setAnswers((current) => ({ ...current, [questionId]: previous }));
        setSaveErrors((current) => ({ ...current, [questionId]: result.message }));
      }
    });
  }

  function confirmFinish() {
    const blank = items.length - answeredCount;
    if (blank > 0 && !window.confirm(`Ainda há ${blank} questão(ões) em branco. Finalizar mesmo assim?`)) return;
    finish();
  }

  return (
    <div className="grid gap-6">
      <div className="bg-background/95 sticky top-0 z-10 grid gap-2 border-b py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            {answeredCount} de {items.length} respondidas
          </span>
          {deadlineMs !== null ? (
            <span className={expired ? "text-destructive font-semibold" : "font-mono font-semibold"} role="timer" aria-live="off">
              {expired ? "Tempo esgotado" : `Tempo restante ${formatRemaining(deadlineMs - now)}`}
            </span>
          ) : (
            <span className="text-muted-foreground">Sem limite de tempo</span>
          )}
        </div>
        <Progress value={items.length === 0 ? 0 : (answeredCount / items.length) * 100} label="Questões respondidas" />
      </div>

      {expired ? (
        <p role="alert" className="text-destructive text-sm">
          O tempo acabou: as respostas não podem mais ser alteradas. Finalize para ver o resultado.
        </p>
      ) : null}

      {items.map((item) => (
        <Card key={item.question.id} id={`questao-${item.position}`}>
          <CardContent className="grid gap-4">
            <QuestionMeta question={item.question} number={item.position} />
            <AnswerChoices
              name={`mq-${item.question.id}`}
              legend={`Resposta da questão ${item.position}`}
              choices={choicesFor(item.question.type, item.question.options)}
              selected={answers[item.question.id] ?? null}
              onSelect={(value) => select(item.question.id, value)}
              disabled={expired || finishing}
            />
            {saveErrors[item.question.id] ? (
              <p role="alert" className="text-destructive text-sm">
                {saveErrors[item.question.id]}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}

      <FormStatus state={finishState} />
      <Button type="button" className="w-fit" onClick={expired ? finish : confirmFinish} disabled={finishing}>
        {finishing ? "Corrigindo..." : expired ? "Ver resultado" : "Finalizar simulado"}
      </Button>
    </div>
  );
}
