"use client";

/**
 * sign-out-button.tsx — Botão "Sair" (desloga APENAS este dispositivo).
 *
 * Quem chama: a área do aluno e o painel admin.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { authClient } from "../auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={handleClick}>
      {pending ? "Saindo..." : "Sair"}
    </Button>
  );
}
