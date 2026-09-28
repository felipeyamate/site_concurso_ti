/**
 * page.tsx — Termos de uso: /termos
 *
 * PROVISÓRIO: o texto definitivo (revisado juridicamente) entra na Fase 7 (LGPD),
 * junto com o registro de consentimento.
 */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <article className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Termos de uso</h1>
      <p className="text-muted-foreground">
        Texto em elaboração. Os termos definitivos serão publicados antes do lançamento da plataforma.
      </p>
    </article>
  );
}
