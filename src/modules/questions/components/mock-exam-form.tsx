"use client";

/**
 * mock-exam-form.tsx — Formulário "Novo simulado": banca, assuntos, quantidade e tempo.
 *
 * Quem chama: a página /simulados (só para quem tem acesso completo).
 * O que faz: envia para `createMockExamAction`, que sorteia as questões e leva à tela do simulado.
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { createMockExamAction } from "../actions";
import { MOCK_EXAM_SIZES, MOCK_EXAM_TIME_LIMITS } from "../mock-exam";

type Option = { id: string; name: string; count: number };

function timeLabel(minutes: number | null): string {
  if (minutes === null) return "Sem limite de tempo";
  if (minutes < 60) return `${minutes} minutos`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hora" : `${String(hours).replace(".", ",")} horas`;
}

export function MockExamForm({ boards, subjects }: { boards: Option[]; subjects: Option[] }) {
  const { state, onSubmit, pending } = useAdminForm(createMockExamAction);
  const errors = state.fieldErrors;

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="mock-board">Banca</Label>
        <NativeSelect id="mock-board" name="boardId" defaultValue="">
          <option value="">Todas as bancas</option>
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name} ({board.count})
            </option>
          ))}
        </NativeSelect>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Assuntos (nenhum marcado = todos)</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {subjects.map((subject) => (
            <label key={subject.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="subjectIds" value={subject.id} />
              <span>
                {subject.name} <span className="text-muted-foreground">({subject.count})</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError id="mock-subjects-error" message={errors.subjectIds} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mock-count">Quantidade de questões</Label>
          <NativeSelect id="mock-count" name="count" defaultValue="20" aria-describedby="mock-count-error">
            {MOCK_EXAM_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} questões
              </option>
            ))}
          </NativeSelect>
          <FieldError id="mock-count-error" message={errors.count} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mock-time">Tempo de prova</Label>
          <NativeSelect id="mock-time" name="timeLimitMinutes" defaultValue="60" aria-describedby="mock-time-error">
            {MOCK_EXAM_TIME_LIMITS.map((minutes) => (
              <option key={minutes ?? "none"} value={minutes ?? ""}>
                {timeLabel(minutes)}
              </option>
            ))}
          </NativeSelect>
          <FieldError id="mock-time-error" message={errors.timeLimitMinutes} />
        </div>
      </div>

      <FormStatus state={state} />
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Sorteando as questões..." : "Começar simulado"}
      </Button>
    </form>
  );
}
