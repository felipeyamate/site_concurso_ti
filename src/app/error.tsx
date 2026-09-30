"use client";

/**
 * error.tsx — Tela de "algo deu errado" quando uma página quebra (erro inesperado no servidor ou na tela).
 *
 * Quem chama: o Next.js, no lugar da página que falhou (o cabeçalho e o rodapé continuam).
 * O que faz: mostra uma mensagem simples com "Tentar de novo" e avisa o Sentry (se configurado).
 * O erro detalhado nunca aparece para o aluno (pode ter dados internos); o código ("digest") ajuda o suporte.
 */
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/observability/report-client-error";

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <div className="mx-auto grid w-full max-w-xl gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Algo deu errado</h1>
      <p className="text-muted-foreground">
        Não conseguimos abrir esta página agora. Tente de novo em alguns instantes.
        {error.digest ? ` (código: ${error.digest})` : ""}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Tentar de novo</Button>
        <Button asChild variant="outline">
          <Link href="/">Ir para o início</Link>
        </Button>
      </div>
    </div>
  );
}
