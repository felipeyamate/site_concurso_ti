"use client";

/**
 * reset-password-form.tsx — Criação da nova senha (tela /redefinir-senha?token=...).
 *
 * Quem chama: `src/app/(auth)/redefinir-senha/page.tsx`, que lê o `token` da URL.
 * O que faz: envia o token + a nova senha. Se der certo, todos os outros dispositivos
 * são deslogados (configurado em auth.ts) e a pessoa pode entrar com a senha nova.
 */
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { authClient } from "../auth-client";
import { getAuthErrorMessage } from "../error-messages";
import { getFieldErrors, resetPasswordSchema } from "../validation";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";

export function ResetPasswordForm({ token }: { token: string }) {
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsed = resetPasswordSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    setPending(true);
    const { error } = await authClient.resetPassword({
      newPassword: parsed.data.password,
      token,
    });
    setPending(false);

    if (error) {
      setFormError(getAuthErrorMessage(error));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="grid gap-4">
        <FormMessage type="success" message="Senha alterada! Agora é só entrar com a nova senha." />
        <Button asChild className="w-full">
          <Link href="/entrar">Ir para o login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <FormMessage type="error" message={formError} />
      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <FormField
          id="password"
          label="Nova senha (mínimo 8 caracteres)"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
          error={fieldErrors.password}
        />
        <FormField
          id="confirmPassword"
          label="Confirme a nova senha"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(event) => setValues({ ...values, confirmPassword: event.target.value })}
          error={fieldErrors.confirmPassword}
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
