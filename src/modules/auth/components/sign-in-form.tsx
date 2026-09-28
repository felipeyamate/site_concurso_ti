"use client";

/**
 * sign-in-form.tsx — Formulário de login (tela /entrar).
 *
 * Quem chama: `src/app/(auth)/entrar/page.tsx`.
 * Três formas de entrar:
 *   1. e-mail + senha;
 *   2. link mágico: a pessoa informa só o e-mail e recebe um link que faz o login;
 *   3. Google (se configurado).
 *
 * "use client" = este componente roda no NAVEGADOR (precisa reagir a cliques e digitação).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { authClient } from "../auth-client";
import { getAuthErrorMessage } from "../error-messages";
import { loginPath } from "../redirect";
import { emailOnlySchema, getFieldErrors, signInSchema } from "../validation";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { GoogleButton } from "./google-button";

type SignInFormProps = {
  redirectTo: string;
  googleEnabled: boolean;
  initialError?: string | null;
};

export function SignInForm({ redirectTo, googleEnabled, initialError = null }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(initialError);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetMessages() {
    setFieldErrors({});
    setFormError(null);
    setSuccessMessage(null);
  }

  // Login com e-mail e senha.
  async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // impede o navegador de recarregar a página ao enviar o form
    resetMessages();

    // 1. Valida no navegador (resposta imediata).
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    // 2. Envia para o servidor.
    setPending(true);
    const { error } = await authClient.signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setPending(false);

    // 3. Trata o resultado.
    if (error) {
      setFormError(getAuthErrorMessage(error));
      return;
    }
    router.push(redirectTo);
    router.refresh(); // recarrega os dados do servidor (agora como usuário logado)
  }

  // Pede o link mágico por e-mail (não precisa de senha).
  async function handleMagicLink() {
    resetMessages();
    const parsed = emailOnlySchema.safeParse({ email });
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    setPending(true);
    const { error } = await authClient.signIn.magicLink({
      email: parsed.data.email,
      callbackURL: redirectTo,
      // Se o link vencer, volta para o login com o erro, sem perder o destino.
      errorCallbackURL: loginPath(redirectTo),
    });
    setPending(false);

    if (error) {
      setFormError(getAuthErrorMessage(error));
      return;
    }
    setSuccessMessage(
      `Enviamos um link de acesso para ${parsed.data.email}. Abra seu e-mail e clique no link (vale por 5 minutos).`,
    );
  }

  return (
    <div className="grid gap-6">
      <FormMessage type="error" message={formError} />
      <FormMessage type="success" message={successMessage} />

      <form onSubmit={handlePasswordSignIn} className="grid gap-4" noValidate>
        <FormField
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />
        <FormField
          id="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />
        <div className="flex justify-end">
          <Link href="/esqueci-senha" className="text-muted-foreground text-sm hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Aguarde..." : "Entrar"}
        </Button>
      </form>

      <div className="text-muted-foreground flex items-center gap-3 text-xs uppercase">
        <span className="bg-border h-px flex-1" />
        ou
        <span className="bg-border h-px flex-1" />
      </div>

      <div className="grid gap-2">
        <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={handleMagicLink}>
          Receber link de acesso por e-mail
        </Button>
        {googleEnabled ? <GoogleButton redirectTo={redirectTo} onError={setFormError} /> : null}
      </div>
    </div>
  );
}
