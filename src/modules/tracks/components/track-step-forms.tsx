"use client";

/**
 * track-step-forms.tsx — Formulários das etapas e passos de uma trilha no painel: criar/editar etapa,
 * incluir aula, incluir treino de questões e editar um passo (dica, banca, meta, mudar de etapa).
 *
 * Quem chama: /admin/conteudo/trilhas/[id] (dentro de cada etapa e no fim da página).
 * "use client" por causa do `useAdminForm` (não apaga o que foi digitado quando a validação falha).
 * Todas as regras (aula repetida, itens que existem, posições) ficam no servidor.
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { addLessonItemAction, addPracticeItemAction, saveSectionAction, updateItemAction } from "../actions";
import { DEFAULT_QUESTION_GOAL } from "../rules";

type Option = { id: string; name: string };
type LessonOption = { id: string; title: string; isPublished: boolean; course: { title: string } };

/** Criar (sem `section`) ou editar uma etapa. */
export function SectionForm({
  trackId,
  section,
  subjects,
}: {
  trackId: string;
  section?: { id: string; title: string; description: string; subjectId: string | null };
  subjects: Option[];
}) {
  const { state, onSubmit, pending, formRef } = useAdminForm(saveSectionAction, { resetOnSuccess: !section });
  const prefix = section ? `section-${section.id}` : "section-new";
  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-3">
      <input type="hidden" name="trackId" value={trackId} />
      {section ? <input type="hidden" name="sectionId" value={section.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-title`}>Nome da etapa</Label>
          <Input
            id={`${prefix}-title`}
            name="title"
            defaultValue={section?.title}
            placeholder="Ex.: Segurança da Informação"
            required
            aria-invalid={state.fieldErrors.title ? true : undefined}
          />
          <FieldError id={`${prefix}-title-error`} message={state.fieldErrors.title} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-subject`}>Assunto (mostra quanto cai na banca)</Label>
          <NativeSelect id={`${prefix}-subject`} name="subjectId" defaultValue={section?.subjectId ?? ""}>
            <option value="">Nenhum</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-description`}>Orientação da etapa (opcional)</Label>
        <Input id={`${prefix}-description`} name="description" defaultValue={section?.description} maxLength={1000} placeholder="Ex.: Comece pelas aulas, depois treine." />
        <FieldError id={`${prefix}-description-error`} message={state.fieldErrors.description} />
      </div>
      <FormStatus state={state} />
      <div>
        <Button type="submit" size="sm" variant={section ? "outline" : "default"} disabled={pending}>
          {pending ? "Salvando..." : section ? "Salvar etapa" : "Criar etapa"}
        </Button>
      </div>
    </form>
  );
}

/** Incluir uma aula (de qualquer curso) no fim da etapa. */
export function LessonItemForm({ sectionId, lessons }: { sectionId: string; lessons: LessonOption[] }) {
  const { state, onSubmit, pending, formRef } = useAdminForm(addLessonItemAction, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-2">
      <input type="hidden" name="sectionId" value={sectionId} />
      <Label htmlFor={`lesson-item-${sectionId}`}>Aula</Label>
      <NativeSelect id={`lesson-item-${sectionId}`} name="lessonId" defaultValue="" aria-invalid={state.fieldErrors.lessonId ? true : undefined}>
        <option value="">Escolha a aula...</option>
        {lessons.map((lesson) => (
          <option key={lesson.id} value={lesson.id}>
            {lesson.course.title} — {lesson.title}
            {lesson.isPublished ? "" : " (rascunho)"}
          </option>
        ))}
      </NativeSelect>
      <FieldError id={`lesson-item-${sectionId}-error`} message={state.fieldErrors.lessonId} />
      <Input name="note" maxLength={300} placeholder="Dica (opcional), ex.: foque em backup" aria-label="Dica da aula" />
      <FormStatus state={state} />
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Incluindo..." : "Incluir aula"}
        </Button>
      </div>
    </form>
  );
}

/** Incluir um treino de questões (assunto, banca e meta) no fim da etapa. */
export function PracticeItemForm({
  sectionId,
  subjects,
  boards,
  defaultSubjectId,
  defaultBoardId,
}: {
  sectionId: string;
  subjects: Option[];
  boards: Option[];
  defaultSubjectId: string | null;
  defaultBoardId: string | null;
}) {
  const { state, onSubmit, pending, formRef } = useAdminForm(addPracticeItemAction, { resetOnSuccess: true });
  const errors = state.fieldErrors;
  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-2">
      <input type="hidden" name="sectionId" value={sectionId} />
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="grid gap-1">
          <Label htmlFor={`practice-subject-${sectionId}`}>Assunto</Label>
          <NativeSelect id={`practice-subject-${sectionId}`} name="subjectId" defaultValue={defaultSubjectId ?? ""} aria-invalid={errors.subjectId ? true : undefined}>
            <option value="">Escolha...</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </NativeSelect>
          <FieldError id={`practice-subject-${sectionId}-error`} message={errors.subjectId} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`practice-board-${sectionId}`}>Banca</Label>
          <NativeSelect id={`practice-board-${sectionId}`} name="boardId" defaultValue={defaultBoardId ?? ""}>
            <option value="">Qualquer banca</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </NativeSelect>
          <FieldError id={`practice-board-${sectionId}-error`} message={errors.boardId} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`practice-goal-${sectionId}`}>Meta (questões)</Label>
          <Input
            id={`practice-goal-${sectionId}`}
            name="questionGoal"
            type="number"
            min={1}
            max={200}
            defaultValue={DEFAULT_QUESTION_GOAL}
            aria-invalid={errors.questionGoal ? true : undefined}
          />
          <FieldError id={`practice-goal-${sectionId}-error`} message={errors.questionGoal} />
        </div>
      </div>
      <Input name="note" maxLength={300} placeholder="Dica (opcional)" aria-label="Dica do treino" />
      <FormStatus state={state} />
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Incluindo..." : "Incluir treino"}
        </Button>
      </div>
    </form>
  );
}

/** Editar um passo: dica; no treino, banca e meta; e a etapa (mudar de etapa leva o passo para o fim dela). */
export function ItemEditForm({
  item,
  sections,
  boards,
}: {
  item: { id: string; kind: "LESSON" | "PRACTICE"; sectionId: string; note: string; boardId: string | null; questionGoal: number };
  sections: Array<{ id: string; title: string }>;
  boards: Option[];
}) {
  const { state, onSubmit, pending } = useAdminForm(updateItemAction);
  const errors = state.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <input type="hidden" name="itemId" value={item.id} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor={`item-section-${item.id}`}>Etapa</Label>
          <NativeSelect id={`item-section-${item.id}`} name="sectionId" defaultValue={item.sectionId}>
            {sections.map((section, index) => (
              <option key={section.id} value={section.id}>
                {index + 1}. {section.title}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`item-note-${item.id}`}>Dica</Label>
          <Input id={`item-note-${item.id}`} name="note" defaultValue={item.note} maxLength={300} aria-invalid={errors.note ? true : undefined} />
          <FieldError id={`item-note-${item.id}-error`} message={errors.note} />
        </div>
        {item.kind === "PRACTICE" ? (
          <>
            <div className="grid gap-1">
              <Label htmlFor={`item-board-${item.id}`}>Banca</Label>
              <NativeSelect id={`item-board-${item.id}`} name="boardId" defaultValue={item.boardId ?? ""}>
                <option value="">Qualquer banca</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </NativeSelect>
              <FieldError id={`item-board-${item.id}-error`} message={errors.boardId} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`item-goal-${item.id}`}>Meta (questões)</Label>
              <Input
                id={`item-goal-${item.id}`}
                name="questionGoal"
                type="number"
                min={1}
                max={200}
                defaultValue={item.questionGoal}
                aria-invalid={errors.questionGoal ? true : undefined}
              />
              <FieldError id={`item-goal-${item.id}-error`} message={errors.questionGoal} />
            </div>
          </>
        ) : null}
      </div>
      <FormStatus state={state} />
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Salvando..." : "Salvar passo"}
        </Button>
      </div>
    </form>
  );
}
