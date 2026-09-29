"use client";

/**
 * use-admin-form.ts — Liga um formulário do painel a uma Server Action, sem perder o que foi digitado.
 *
 * Quem chama: os formulários do painel admin (cursos, aulas, usuários...).
 * O que devolve: `state` (resultado da última tentativa), `onSubmit` (para o <form>) e `pending`.
 *
 * Por que não usar só `<form action={...}>`: nesse modo o React LIMPA o formulário depois de
 * cada envio — inclusive quando a validação falha, e aí a pessoa perderia o texto digitado.
 * Aqui enviamos "à mão" (`onSubmit`), então os campos continuam como estavam.
 * `resetOnSuccess`: limpa os campos só quando deu certo (útil em "Novo módulo", "Nova aula").
 */
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";

import { initialFormState, type FormState } from "@/lib/form-state";

type Action = (previous: FormState, formData: FormData) => Promise<FormState>;

export function useAdminForm(action: Action, options: { resetOnSuccess?: boolean } = {}) {
  const [state, dispatch, pending] = useActionState(action, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (options.resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [state, options.resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return { state, onSubmit, pending, formRef };
}
