"use client";

/**
 * global-error.tsx — Último recurso: erro na moldura do site inteiro (o `layout.tsx` raiz).
 *
 * Quem chama: o Next.js, quando até o layout principal falha (raro). Por isso esta tela tem o
 * próprio <html> e <body> e não usa os componentes do site (eles podem ser a causa do erro).
 * Avisa o Sentry (se configurado).
 */
import { useEffect } from "react";

import { reportClientError } from "@/lib/observability/report-client-error";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1>Algo deu errado</h1>
        <p>O site está com um problema no momento. Tente de novo em alguns instantes.</p>
        <button type="button" onClick={reset} style={{ padding: "0.5rem 1rem", marginTop: "1rem" }}>
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
