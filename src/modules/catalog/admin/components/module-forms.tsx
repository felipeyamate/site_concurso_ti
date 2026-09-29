"use client";

/**
 * module-forms.tsx — Formulários pequenos da grade do curso: novo módulo, renomear módulo e nova aula.
 *
 * Quem chama: /admin/cursos/[id].
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createLessonAction, createModuleAction, renameModuleAction } from "../actions";

export function NewModuleForm({ courseId }: { courseId: string }) {
  const { state, onSubmit, pending, formRef } = useAdminForm(createModuleAction, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-2">
      <input type="hidden" name="courseId" value={courseId} />
      <Label htmlFor="new-module-title">Novo módulo</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="new-module-title"
          name="title"
          required
          placeholder="Ex.: Segurança da Informação"
          className="min-w-0 flex-1"
          aria-invalid={state.fieldErrors.title ? true : undefined}
        />
        <Button type="submit" disabled={pending}>
          Adicionar módulo
        </Button>
      </div>
      <FieldError id="new-module-title-error" message={state.fieldErrors.title} />
      {!state.fieldErrors.title ? <FormStatus state={state} /> : null}
    </form>
  );
}

export function ModuleTitleForm({ moduleId, title, number }: { moduleId: string; title: string; number: number }) {
  const { state, onSubmit, pending } = useAdminForm(renameModuleAction);
  const inputId = `module-title-${moduleId}`;
  return (
    <form onSubmit={onSubmit} className="grid min-w-0 flex-1 gap-1">
      <input type="hidden" name="moduleId" value={moduleId} />
      <Label htmlFor={inputId} className="text-muted-foreground text-xs">
        Módulo {number}
      </Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          name="title"
          defaultValue={title}
          required
          className="min-w-0 flex-1 font-medium"
          aria-invalid={state.fieldErrors.title ? true : undefined}
        />
        <Button type="submit" variant="outline" size="sm" className="h-9" disabled={pending}>
          Salvar
        </Button>
      </div>
      <FieldError id={`${inputId}-error`} message={state.fieldErrors.title ?? (state.status === "error" ? state.message ?? undefined : undefined)} />
      {state.status === "success" ? <p className="text-muted-foreground text-xs">{state.message}</p> : null}
    </form>
  );
}

export function NewLessonForm({ moduleId }: { moduleId: string }) {
  const { state, onSubmit, pending } = useAdminForm(createLessonAction);
  const inputId = `new-lesson-${moduleId}`;
  return (
    <form onSubmit={onSubmit} className="grid gap-1">
      <input type="hidden" name="moduleId" value={moduleId} />
      <Label htmlFor={inputId} className="sr-only">
        Título da nova aula
      </Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={inputId}
          name="title"
          required
          placeholder="Título da nova aula"
          className="min-w-0 flex-1"
          aria-invalid={state.fieldErrors.title ? true : undefined}
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Criando..." : "Adicionar aula"}
        </Button>
      </div>
      <FieldError id={`${inputId}-error`} message={state.fieldErrors.title ?? (state.status === "error" ? state.message ?? undefined : undefined)} />
    </form>
  );
}
