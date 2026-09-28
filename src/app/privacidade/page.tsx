/**
 * page.tsx — Política de privacidade: /privacidade
 *
 * PROVISÓRIO: o texto definitivo (LGPD) entra na Fase 7.
 */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Política de privacidade</h1>
      <p className="text-muted-foreground">
        Texto em elaboração. A política definitiva, em conformidade com a LGPD, será publicada antes
        do lançamento da plataforma.
      </p>
    </article>
  );
}
