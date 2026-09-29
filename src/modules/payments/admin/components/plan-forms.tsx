"use client";

/**
 * plan-forms.tsx — Formulários da ASSINATURA no painel: "Novo plano", "Dados do plano" e
 * "Cursos incluídos na assinatura".
 *
 * Quem chama: /admin/vendas/planos e /admin/vendas/planos/[id].
 * A lista de cursos incluídos vale para TODOS os planos (o plano muda só preço e ciclo).
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { createPlanAction, setSubscriptionCoursesAction, updatePlanAction } from "../actions";

function CycleSelect({ id, defaultValue, invalid }: { id: string; defaultValue: string; invalid: boolean }) {
  return (
    <NativeSelect id={id} name="cycle" defaultValue={defaultValue} aria-invalid={invalid ? true : undefined}>
      <option value="MONTHLY">Mensal</option>
      <option value="YEARLY">Anual</option>
    </NativeSelect>
  );
}

export function NewPlanForm() {
  const { state, onSubmit, pending } = useAdminForm(createPlanAction);
  const errors = state.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
      <div className="grid gap-2 sm:col-span-3">
        <Label htmlFor="new-plan-title">Nome do plano</Label>
        <Input id="new-plan-title" name="title" required placeholder="Ex.: Assinatura mensal" aria-invalid={errors.title ? true : undefined} />
        <FieldError id="new-plan-title-error" message={errors.title} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-plan-price">Preço por ciclo (R$)</Label>
        <Input id="new-plan-price" name="price" inputMode="decimal" required placeholder="49,90" aria-invalid={errors.price ? true : undefined} />
        <FieldError id="new-plan-price-error" message={errors.price} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-plan-cycle">Ciclo</Label>
        <CycleSelect id="new-plan-cycle" defaultValue="MONTHLY" invalid={Boolean(errors.cycle)} />
        <FieldError id="new-plan-cycle-error" message={errors.cycle} />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Criando..." : "Criar plano"}
        </Button>
      </div>
      <div className="sm:col-span-3">
        <FormStatus state={state} />
      </div>
    </form>
  );
}

type PlanDetails = {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: string;
  cycle: "MONTHLY" | "YEARLY";
  isActive: boolean;
};

export function PlanForm({ plan }: { plan: PlanDetails }) {
  const { state, onSubmit, pending } = useAdminForm(updatePlanAction);
  const errors = state.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="planId" value={plan.id} />
      <div className="grid gap-2">
        <Label htmlFor="plan-title">Nome</Label>
        <Input id="plan-title" name="title" defaultValue={plan.title} required aria-invalid={errors.title ? true : undefined} />
        <FieldError id="plan-title-error" message={errors.title} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="plan-slug">Endereço (slug)</Label>
        <Input id="plan-slug" name="slug" defaultValue={plan.slug} required aria-invalid={errors.slug ? true : undefined} />
        <p className="text-muted-foreground text-xs">
          Página de assinatura: /assinar/<strong>{plan.slug}</strong>
        </p>
        <FieldError id="plan-slug-error" message={errors.slug} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="plan-description">Descrição (aparece em /planos)</Label>
        <Textarea id="plan-description" name="description" defaultValue={plan.description} rows={3} aria-invalid={errors.description ? true : undefined} />
        <FieldError id="plan-description-error" message={errors.description} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="plan-price">Preço por ciclo (R$)</Label>
          <Input id="plan-price" name="price" inputMode="decimal" defaultValue={plan.price} required aria-invalid={errors.price ? true : undefined} />
          <FieldError id="plan-price-error" message={errors.price} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="plan-cycle">Ciclo</Label>
          <CycleSelect id="plan-cycle" defaultValue={plan.cycle} invalid={Boolean(errors.cycle)} />
          <FieldError id="plan-cycle-error" message={errors.cycle} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={plan.isActive} className="accent-primary size-4" />
        Ativo (aparece em /planos)
      </label>
      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar plano"}
        </Button>
      </div>
    </form>
  );
}

type CourseOption = { id: string; title: string; isPublished: boolean; includedInSubscription: boolean };

export function SubscriptionCoursesForm({ courses }: { courses: CourseOption[] }) {
  const { state, onSubmit, pending } = useAdminForm(setSubscriptionCoursesAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {courses.length === 0 ? <p className="text-muted-foreground text-sm">Nenhum curso cadastrado ainda.</p> : null}
      {courses.map((course) => (
        <label key={course.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="courseIds"
            value={course.id}
            defaultChecked={course.includedInSubscription}
            className="accent-primary size-4"
          />
          {course.title}
          {course.isPublished ? null : <span className="text-muted-foreground text-xs">(rascunho)</span>}
        </label>
      ))}
      <p className="text-muted-foreground text-xs">
        Incluir um curso libera o acesso na hora para quem está com a assinatura em dia. Retirar: quem já tinha continua até o
        fim do período pago (sem ganhar mais tempo).
      </p>
      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando e recalculando..." : "Salvar cursos da assinatura"}
        </Button>
      </div>
    </form>
  );
}
