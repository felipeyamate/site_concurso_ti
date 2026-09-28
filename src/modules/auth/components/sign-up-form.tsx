"use client";

/**
 * sign-up-form.tsx — Formulário de cadastro (tela /cadastro).
 *
 * Quem chama: `src/app/(auth)/cadastro/page.tsx`.
 * O que acontece ao enviar:
 *   1. valida os campos no navegador;
 *   2. o servidor cria o usuário (sempre com perfil STUDENT) e já faz o login;
 *   3. um e-mail de confirmação é enviado;
 *   4. a pessoa é levada para a área do aluno.
 */
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { authClient } from "../auth-client";
import { getAuthErrorMessage } from "../error-messages";
import { getFieldErrors, signUpSchema } from "../validation";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { GoogleButton } from "./google-button";

type SignUpFormProps = {
  redirectTo: string;
  googleEnabled: boolean;
};

export function SignUpForm({ redirectTo, googleEnabled }: SignUpFormProps) {
  const router = useRouter();
  // Um único objeto com todos os campos (como um dict do Python).
  const [values, setValues] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Atualiza um campo sem perder os outros (o `...values` copia o objeto atual).
  function updateField(field: keyof typeof values, value: string) {
    setValues({ ...values, [field]: value });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsed = signUpSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    setPending(true);
    const { error } = await authClient.signUp.email({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      // Para onde o link de confirmação de e-mail leva depois de confirmar.
      callbackURL: redirectTo,
    });
    setPending(false);

    if (error) {
      setFormError(getAuthErrorMessage(error));
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <FormMessage type="error" message={formError} />

      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <FormField
          id="name"
          label="Nome"
          autoComplete="name"
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
          error={fieldErrors.name}
        />
        <FormField
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => updateField("email", event.target.value)}
          error={fieldErrors.email}
        />
        <FormField
          id="password"
          label="Senha (mínimo 8 caracteres)"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => updateField("password", event.target.value)}
          error={fieldErrors.password}
        />
        <FormField
          id="confirmPassword"
          label="Confirme a senha"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(event) => updateField("confirmPassword", event.target.value)}
          error={fieldErrors.confirmPassword}
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Criando sua conta..." : "Criar conta"}
        </Button>
      </form>

      {googleEnabled ? (
        <>
          <div className="text-muted-foreground flex items-center gap-3 text-xs uppercase">
            <span className="bg-border h-px flex-1" />
            ou
            <span className="bg-border h-px flex-1" />
          </div>
          <GoogleButton redirectTo={redirectTo} onError={setFormError} />
        </>
      ) : null}
    </div>
  );
}
