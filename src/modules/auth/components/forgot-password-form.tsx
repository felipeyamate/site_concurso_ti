"use client";

/**
 * forgot-password-form.tsx — Pedido de redefinição de senha (tela /esqueci-senha).
 *
 * Quem chama: `src/app/(auth)/esqueci-senha/page.tsx`.
 * O que faz: envia um e-mail com um link para /redefinir-senha?token=...
 *
 * Segurança: a mensagem de sucesso é a MESMA exista ou não uma conta com o e-mail.
 * Assim ninguém usa esta tela para descobrir quem é aluno da plataforma.
 */
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { authClient } from "../auth-client";
import { getAuthErrorMessage } from "../error-messages";
import { emailOnlySchema, getFieldErrors } from "../validation";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setSuccessMessage(null);

    const parsed = emailOnlySchema.safeParse({ email });
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    setPending(true);
    const { error } = await authClient.requestPasswordReset({
      email: parsed.data.email,
      // Página do NOSSO site que recebe o token e mostra o formulário de nova senha.
      redirectTo: "/redefinir-senha",
    });
    setPending(false);

    if (error) {
      setFormError(getAuthErrorMessage(error));
      return;
    }
    setSuccessMessage(
      "Se existir uma conta com este e-mail, você vai receber um link para criar uma nova senha em alguns minutos.",
    );
  }

  return (
    <div className="grid gap-6">
      <FormMessage type="error" message={formError} />
      <FormMessage type="success" message={successMessage} />
      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <FormField
          id="email"
          label="E-mail da sua conta"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Enviando..." : "Enviar link"}
        </Button>
      </form>
    </div>
  );
}
