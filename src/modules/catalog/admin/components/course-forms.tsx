"use client";

/**
 * course-forms.tsx — Formulários de curso no painel: "Novo curso" e "Dados do curso".
 *
 * Quem chama: /admin/cursos (novo) e /admin/cursos/[id] (editar).
 * As regras (validação, endereço único, rascunho) ficam no servidor (`actions.ts`).
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createCourseAction, updateCourseAction } from "../actions";

export function NewCourseForm() {
  const { state, onSubmit, pending } = useAdminForm(createCourseAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="grid gap-2">
        <Label htmlFor="new-course-title">Título do novo curso</Label>
        <Input
          id="new-course-title"
          name="title"
          required
          placeholder="Ex.: TI para o Banco do Brasil — Cesgranrio"
          aria-invalid={state.fieldErrors.title ? true : undefined}
        />
        <FieldError id="new-course-title-error" message={state.fieldErrors.title} />
      </div>
      <Button type="submit" disabled={pending} className="sm:mt-5.5">
        {pending ? "Criando..." : "Criar curso"}
      </Button>
      {state.status === "error" && !state.fieldErrors.title ? (
        <div className="sm:col-span-2">
          <FormStatus state={state} />
        </div>
      ) : null}
    </form>
  );
}

type CourseDetails = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string;
  isPublished: boolean;
};

export function CourseDetailsForm({ course }: { course: CourseDetails }) {
  const { state, onSubmit, pending } = useAdminForm(updateCourseAction);
  const errors = state.fieldErrors;

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="courseId" value={course.id} />

      <div className="grid gap-2">
        <Label htmlFor="course-title">Título</Label>
        <Input id="course-title" name="title" defaultValue={course.title} required aria-invalid={errors.title ? true : undefined} />
        <FieldError id="course-title-error" message={errors.title} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="course-slug">Endereço (slug)</Label>
        <Input id="course-slug" name="slug" defaultValue={course.slug} required aria-invalid={errors.slug ? true : undefined} />
        <p className="text-muted-foreground text-xs">
          Aparece no link: /cursos/<strong>{course.slug}</strong>. Evite mudar depois de publicado (links antigos param de funcionar).
        </p>
        <FieldError id="course-slug-error" message={errors.slug} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="course-subtitle">Frase curta (aparece no catálogo)</Label>
        <Input id="course-subtitle" name="subtitle" defaultValue={course.subtitle ?? ""} aria-invalid={errors.subtitle ? true : undefined} />
        <FieldError id="course-subtitle-error" message={errors.subtitle} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="course-description">Descrição</Label>
        <Textarea
          id="course-description"
          name="description"
          defaultValue={course.description}
          rows={5}
          aria-invalid={errors.description ? true : undefined}
        />
        <FieldError id="course-description-error" message={errors.description} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={course.isPublished} className="accent-primary size-4" />
        Publicado (aparece no catálogo para os alunos)
      </label>

      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar curso"}
        </Button>
      </div>
    </form>
  );
}
