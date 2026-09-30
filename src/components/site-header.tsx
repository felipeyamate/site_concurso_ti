/**
 * site-header.tsx — Cabeçalho do site (logo + links principais).
 *
 * Quem chama: `src/app/layout.tsx`, em todas as páginas.
 *
 * É propositalmente "estático" (não consulta quem está logado): assim as páginas públicas
 * continuam rápidas e boas para o Google. Quem não estiver logado e clicar em
 * "Área do aluno" é levado ao login automaticamente.
 */
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Concurso TI
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/cursos">Cursos</Link>
          </Button>
          {/* Concursos e Blog só a partir de telas médias (no celular estão no rodapé). */}
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link href="/concursos">Concursos</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link href="/blog">Blog</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/area-do-aluno">Área do aluno</Link>
          </Button>
          {/* No celular, só os dois primeiros links cabem; "Criar conta" continua na página
              inicial, no login e nas páginas dos cursos. */}
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/cadastro">Criar conta</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
