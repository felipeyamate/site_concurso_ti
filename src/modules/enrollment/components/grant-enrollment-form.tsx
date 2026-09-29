"use client";

/**
 * grant-enrollment-form.tsx — Formulário "Matricular / renovar" de um aluno no painel (só ADMIN).
 *
 * Quem chama: /admin/usuarios/[id].
 * Dias vazio = acesso sem data de fim. Se o aluno já tem matrícula ativa, os dias são SOMADOS.
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { grantEnrollmentAction } from "../admin-actions";

type CourseOption = { id: string; title: string; isPublished: boolean };

export function GrantEnrollmentForm({ userId, courses }: { userId: string; courses: CourseOption[] }) {
  const { state, onSubmit, pending } = useAdminForm(grantEnrollmentAction);
  const errors = state.fieldErrors;

  if (courses.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhum curso cadastrado ainda.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <div className="grid gap-2">
          <Label htmlFor="grant-course">Curso</Label>
          <NativeSelect id="grant-course" name="courseId" defaultValue="" aria-invalid={errors.courseId ? true : undefined}>
            <option value="" disabled>
              Escolha um curso
            </option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
                {course.isPublished ? "" : " (rascunho)"}
              </option>
            ))}
          </NativeSelect>
          <FieldError id="grant-course-error" message={errors.courseId} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="grant-days">Dias de acesso</Label>
          <Input
            id="grant-days"
            name="days"
            inputMode="numeric"
            placeholder="Vazio = sem fim"
            aria-invalid={errors.days ? true : undefined}
          />
          <FieldError id="grant-days-error" message={errors.days} />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Se a matrícula ainda estiver ativa, os dias são somados ao que falta. Vencida ou revogada: recomeça hoje.
      </p>
      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Matricular / renovar"}
        </Button>
      </div>
    </form>
  );
}
