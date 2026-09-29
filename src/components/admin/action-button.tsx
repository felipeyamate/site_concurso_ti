"use client";

/**
 * action-button.tsx — Botão que dispara uma Server Action do painel (↑, ↓, Apagar, Revogar...).
 *
 * Quem chama: as páginas do painel admin.
 * O que faz: um mini-formulário com campos escondidos (ex.: o ID do item) e um botão.
 *  - `confirmMessage`: pergunta "tem certeza?" antes (para ações que apagam coisas);
 *  - mostra o erro da ação logo abaixo do botão (ex.: "o módulo ainda tem aulas").
 *
 * `useActionState` (React) guarda o resultado da última chamada da ação e diz se ela ainda está
 * rodando (`pending`) — com isso o botão fica desativado enquanto espera.
 */
import { useActionState, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { initialFormState, type FormState } from "@/lib/form-state";

type ActionButtonProps = {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  children: ReactNode;
  confirmMessage?: string;
} & Pick<ComponentProps<typeof Button>, "variant" | "size" | "title" | "aria-label" | "disabled">;

export function ActionButton({ action, fields, children, confirmMessage, ...buttonProps }: ActionButtonProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button
        type="submit"
        {...buttonProps}
        disabled={pending || buttonProps.disabled}
        onClick={(event) => {
          // "Cancelar" na pergunta = o clique não envia o formulário.
          if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
        }}
      >
        {children}
      </Button>
      {state.status === "error" && state.message ? (
        <span role="alert" className="text-destructive max-w-xs text-xs">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
