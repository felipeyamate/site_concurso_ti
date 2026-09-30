/**
 * page.tsx — Catálogo de cursos: /cursos  (público)
 *
 * Quem chama: o Next.js, quando alguém acessa /cursos (link "Cursos" do cabeçalho).
 * Mostra os cursos publicados. Professores/admin também veem os rascunhos (com etiqueta).
 *
 * Página dinâmica: lê quem está logado (cookies) e consulta o banco a cada acesso.
 * (Na Fase 6, a vitrine pública ganha cache e SEO próprios.)
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";
import { hasMinimumRole } from "@/modules/auth/roles";
import { getCurrentSession } from "@/modules/auth/session";
import { listCatalogSummaries } from "@/modules/catalog/catalog.server";

export const metadata: Metadata = {
  alternates: { canonical: "/cursos" },
  title: "Cursos",
  description: "Cursos de Informática e TI para concursos, em linguagem simples.",
};

export default async function CoursesPage() {
  // Ler a sessão usa os cookies da requisição: isso já faz a página ser montada a cada acesso
  // (e não "congelada" no build, o que tentaria acessar o banco durante o build).
  const session = await getCurrentSession();
  const isStaff = hasMinimumRole(session?.user.role, "TEACHER");
  const courses = await listCatalogSummaries({ includeDrafts: isStaff });

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Cursos</h1>
        <p className="text-muted-foreground">
          Comece pelo Curso Base e estude primeiro o que mais cai nas provas.
        </p>
      </div>

      {courses.length === 0 ? (
        <p className="text-muted-foreground">Nenhum curso disponível ainda.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => {
            return (
              <Link key={course.id} href={`/cursos/${course.slug}`} className="group">
                <Card className="group-hover:border-primary/40 h-full transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg leading-snug">{course.title}</CardTitle>
                      {course.isPublished ? null : <Badge variant="secondary">Rascunho</Badge>}
                    </div>
                    {course.subtitle ? <CardDescription>{course.subtitle}</CardDescription> : null}
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-sm">
                    {course.moduleCount} módulos · {course.lessonCount} aulas ·{" "}
                    {formatDuration(course.totalDurationSeconds)}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
