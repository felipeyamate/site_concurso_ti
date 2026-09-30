/**
 * legal-document.tsx — Moldura das páginas legais (Termos de uso e Política de privacidade).
 *
 * Quem chama: /termos e /privacidade.
 * Mostra: o título, a versão (data) dos textos e as seções. `Section` é cada bloco com título.
 * Componentes do servidor (sem "use client"): o texto chega pronto no HTML, bom para o Google.
 */
import type { ReactNode } from "react";

import { LEGAL_VERSION_LABEL } from "../version";

export function LegalDocument({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">Versão de {LEGAL_VERSION_LABEL}.</p>
        <div className="leading-relaxed">{intro}</div>
      </header>
      {children}
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-2 text-sm leading-relaxed [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1 [&_ul]:pl-5">{children}</div>
    </section>
  );
}
