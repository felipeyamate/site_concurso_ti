"use client";

/**
 * lesson-subjects-form.tsx — "Assuntos desta aula" no painel (Fase 8): caixas para marcar os assuntos
 * (do banco de questões) que a aula ensina.
 *
 * Quem chama: /admin/cursos/[id]/aulas/[aulaId].
 * Para que serve: quem erra uma questão do assunto vê "estude esta aula"; a página da aula mostra
 * "treinar questões deste assunto"; e o "montar pelo que mais cai" das trilhas usa esta ligação.
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";

import { setLessonSubjectsAction } from "../actions";

export function LessonSubjectsForm({
  lessonId,
  subjects,
  selectedIds,
}: {
  lessonId: string;
  subjects: Array<{ id: string; name: string }>;
  selectedIds: string[];
}) {
  const { state, onSubmit, pending } = useAdminForm(setLessonSubjectsAction);
  if (subjects.length === 0) {
    return <p className="text-muted-foreground text-sm">Cadastre os assuntos em Banco de questões → Bancas, assuntos e provas.</p>;
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <input type="hidden" name="lessonId" value={lessonId} />
      <fieldset className="grid gap-1 sm:grid-cols-2">
        <legend className="sr-only">Assuntos que a aula ensina</legend>
        {subjects.map((subject) => (
          <label key={subject.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="subjectIds" value={subject.id} defaultChecked={selectedIds.includes(subject.id)} className="accent-primary size-4" />
            {subject.name}
          </label>
        ))}
      </fieldset>
      <FieldError id="lesson-subjects-error" message={state.fieldErrors.subjectIds} />
      <FormStatus state={state} />
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Salvando..." : "Salvar assuntos"}
        </Button>
      </div>
    </form>
  );
}
