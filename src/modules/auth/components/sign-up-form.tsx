"use client";

/**
 * sign-up-form.tsx — Formulário de cadastro (tela /cadastro).
 *
 * Quem chama: `src/app/(auth)/cadastro/page.tsx`.
 * O que acontece ao enviar:
 *   1. valida os campos no navegador (inclusive a caixa "Li e aceito os Termos e a Política");
 *   2. o servidor cria o usuário (sempre com perfil STUDENT) e já faz o login;
 *   3. grava o aceite dos termos (LGPD: data, versão, IP e navegador) — se falhar, a área logada
 *      pede o aceite de novo, então nada se perde;
 *   4. um e-mail de confirmação é enviado;
 *   5. a pessoa é levada para a área do aluno.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { recordSignUpConsentAction } from "@/modules/privacy/actions";

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
  const [acceptLegal, setAcceptLegal] = useState(false);
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

    const parsed = signUpSchema.safeParse({ ...values, acceptLegal });
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
    if (error) {
      setPending(false);
      setFormError(getAuthErrorMessage(error));
      return;
    }
    // Conta criada e logada: registra o aceite dos termos. Uma falha aqui não impede de seguir
    // (a área logada pediria o aceite de novo).
    try {
      await recordSignUpConsentAction();
    } catch {
      // segue: o aceite será pedido na próxima página
    }
    setPending(false);
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
        <div className="grid gap-1">
          <label className="flex items-start gap-2 text-sm leading-relaxed">
            <input
              type="checkbox"
              name="acceptLegal"
              checked={acceptLegal}
              onChange={(event) => setAcceptLegal(event.target.checked)}
              className="accent-primary mt-1 size-4 shrink-0"
              aria-invalid={fieldErrors.acceptLegal ? true : undefined}
              aria-describedby={fieldErrors.acceptLegal ? "acceptLegal-error" : undefined}
            />
            <span>
              Li e aceito os{" "}
              <Link href="/termos" target="_blank" className="underline">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" target="_blank" className="underline">
                Política de privacidade
              </Link>
              .
            </span>
          </label>
          {fieldErrors.acceptLegal ? (
            <p id="acceptLegal-error" className="text-destructive text-sm">
              {fieldErrors.acceptLegal}
            </p>
          ) : null}
        </div>
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
