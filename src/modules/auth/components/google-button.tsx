"use client";

/**
 * google-button.tsx — Botão "Continuar com Google".
 *
 * Quem chama: as telas de login e de cadastro, SOMENTE quando o Google está configurado
 * (a página decide, com base nas variáveis GOOGLE_CLIENT_ID/SECRET).
 *
 * Fluxo: clique → o navegador vai para o Google → a pessoa autoriza → o Google devolve para
 * /api/auth/callback/google → o Better Auth cria/entra na conta → volta para `redirectTo`.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { authClient } from "../auth-client";
import { getAuthErrorMessage } from "../error-messages";

type GoogleButtonProps = {
  redirectTo: string;
  onError: (message: string) => void;
};

export function GoogleButton({ redirectTo, onError }: GoogleButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: redirectTo,
      errorCallbackURL: "/entrar",
    });
    // Se deu certo, o navegador já está indo para o Google; só tratamos o erro.
    if (error) {
      onError(getAuthErrorMessage(error));
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={handleClick}>
      {pending ? "Abrindo o Google..." : "Continuar com Google"}
    </Button>
  );
}
