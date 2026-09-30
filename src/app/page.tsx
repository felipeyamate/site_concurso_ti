/**
 * page.tsx — Página inicial: /
 *
 * Quem chama: o Next.js, na raiz do site.
 * PROVISÓRIA: a página de vendas de verdade (com SEO e landing pages por edital) é da Fase 6.
 */
import Link from "next/link";

import { Button } from "@/components/ui/button";

const HIGHLIGHTS: Array<{ title: string; text: string; link?: { href: string; label: string } }> = [
  {
    title: "Linguagem simples",
    text: "TI explicada para quem nunca estudou tecnologia.",
  },
  {
    title: "Foco no que mais cai",
    text: "Conteúdo priorizado pela incidência real nas provas, por banca e por assunto.",
    link: { href: "/o-que-mais-cai", label: "Ver o que mais cai" },
  },
  {
    title: "Prática guiada",
    text: "Questões comentadas, filtráveis por banca, assunto e concurso.",
    link: { href: "/questoes", label: "Resolver questões" },
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-12 px-4 py-16">
      <section className="grid gap-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Informática e TI para concursos, do zero
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
          Garanta os pontos de Informática, TI e Segurança da Informação na sua prova — mesmo
          que você não seja da área.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/cadastro">Criar conta grátis</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/cursos">Ver os cursos</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {HIGHLIGHTS.map((item) => (
          <div key={item.title} className="rounded-xl border p-6">
            <h2 className="mb-2 font-semibold">{item.title}</h2>
            <p className="text-muted-foreground text-sm">{item.text}</p>
            {item.link ? (
              <Link href={item.link.href} className="mt-3 inline-block text-sm underline">
                {item.link.label}
              </Link>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
