"use client";

/**
 * completion-toggle.tsx — Botão "Marcar como concluída" / "Concluída ✓ (desmarcar)".
 *
 * Quem chama: a página da aula.
 * Útil para aulas curtas ou quando o aluno já domina o assunto. A ação no servidor confere
 * login e acesso antes de gravar, e atualiza a página sozinha (revalidatePath).
 */
import { CircleCheck } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { setLessonCompletedAction } from "../actions";

export function CompletionToggle({ lessonId, completed }: { lessonId: string; completed: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await setLessonCompletedAction({ lessonId, completed: !completed });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant={completed ? "secondary" : "outline"} size="sm" disabled={isPending} onClick={handleClick}>
        <CircleCheck />
        {completed ? "Concluída (desmarcar)" : "Marcar como concluída"}
      </Button>
      {error ? <span className="text-destructive text-sm">{error}</span> : null}
    </div>
  );
}
