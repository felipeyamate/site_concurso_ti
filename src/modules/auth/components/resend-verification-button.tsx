"use client";

/**
 * resend-verification-button.tsx — Reenvia o e-mail de confirmação de conta.
 *
 * Quem chama: o aviso "confirme seu e-mail" na área do aluno.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { authClient } from "../auth-client";
import { getAuthErrorMessage } from "../error-messages";

export function ResendVerificationButton({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "pending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setStatus("pending");
    setError(null);
    const result = await authClient.sendVerificationEmail({ email, callbackURL: "/area-do-aluno" });
    if (result.error) {
      setError(getAuthErrorMessage(result.error));
      setStatus("idle");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return <p className="text-sm">E-mail reenviado. Confira sua caixa de entrada (e o spam).</p>;
  }

  return (
    <div className="grid gap-1">
      <Button variant="outline" size="sm" className="w-fit" disabled={status === "pending"} onClick={handleClick}>
        {status === "pending" ? "Enviando..." : "Reenviar e-mail de confirmação"}
      </Button>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
