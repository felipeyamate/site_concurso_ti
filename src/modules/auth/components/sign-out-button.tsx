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

// `afterSignOut`: para onde ir depois de sair (padrão: página inicial). A página "Minha conta"
// usa o login com volta, para quem precisa entrar de novo antes de excluir a conta.
export function SignOutButton({ afterSignOut = "/" }: { afterSignOut?: string } = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  // Passos: pede ao servidor para encerrar a sessão; se deu certo, vai para a página inicial.
  // Se falhar (ex.: sem internet), reativa o botão e avisa, em vez de ficar travado em "Saindo...".
  async function handleClick() {
    setPending(true);
    setFailed(false);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        setFailed(true);
        return;
      }
      router.push(afterSignOut);
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {failed ? <span className="text-destructive text-sm">Não foi possível sair. Tente de novo.</span> : null}
      <Button variant="outline" size="sm" disabled={pending} onClick={handleClick}>
        {pending ? "Saindo..." : "Sair"}
      </Button>
    </div>
  );
}
