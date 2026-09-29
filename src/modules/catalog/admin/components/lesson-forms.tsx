"use client";

/**
 * lesson-forms.tsx — Formulário "Dados da aula" no painel (título, endereço, módulo, grátis, publicada).
 *
 * Quem chama: /admin/cursos/[id]/aulas/[aulaId].
 * O vídeo e os PDFs têm formulários próprios (`lesson-video-form.tsx` e o gerenciador de materiais).
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { updateLessonAction } from "../actions";

type LessonDetails = {
  id: string;
  moduleId: string;
  title: string;
  slug: string;
  description: string;
  isFreePreview: boolean;
  isPublished: boolean;
};

type ModuleOption = { id: string; title: string; position: number };

export function LessonDetailsForm({
  lesson,
  courseSlug,
  modules,
}: {
  lesson: LessonDetails;
  courseSlug: string;
  modules: ModuleOption[];
}) {
  const { state, onSubmit, pending } = useAdminForm(updateLessonAction);
  const errors = state.fieldErrors;

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="lessonId" value={lesson.id} />

      <div className="grid gap-2">
        <Label htmlFor="lesson-title">Título</Label>
        <Input id="lesson-title" name="title" defaultValue={lesson.title} required aria-invalid={errors.title ? true : undefined} />
        <FieldError id="lesson-title-error" message={errors.title} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="lesson-slug">Endereço (slug)</Label>
        <Input id="lesson-slug" name="slug" defaultValue={lesson.slug} required aria-invalid={errors.slug ? true : undefined} />
        <p className="text-muted-foreground text-xs">
          Link da aula: /cursos/{courseSlug}/aulas/<strong>{lesson.slug}</strong>
        </p>
        <FieldError id="lesson-slug-error" message={errors.slug} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="lesson-module">Módulo</Label>
        <NativeSelect id="lesson-module" name="moduleId" defaultValue={lesson.moduleId} aria-invalid={errors.moduleId ? true : undefined}>
          {modules.map((item) => (
            <option key={item.id} value={item.id}>
              {item.position}. {item.title}
            </option>
          ))}
        </NativeSelect>
        <p className="text-muted-foreground text-xs">Ao trocar de módulo, a aula vai para o fim do módulo escolhido.</p>
        <FieldError id="lesson-module-error" message={errors.moduleId} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="lesson-description">Resumo (aparece embaixo do vídeo)</Label>
        <Textarea
          id="lesson-description"
          name="description"
          defaultValue={lesson.description}
          rows={4}
          aria-invalid={errors.description ? true : undefined}
        />
        <FieldError id="lesson-description-error" message={errors.description} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isFreePreview" defaultChecked={lesson.isFreePreview} className="accent-primary size-4" />
        Aula grátis (qualquer pessoa com conta assiste, mesmo sem matrícula)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={lesson.isPublished} className="accent-primary size-4" />
        Publicada (visível para os alunos, se o curso também estiver publicado)
      </label>

      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar aula"}
        </Button>
      </div>
    </form>
  );
}
