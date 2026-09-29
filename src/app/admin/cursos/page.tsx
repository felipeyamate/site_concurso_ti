/**
 * page.tsx — Lista de cursos no painel: /admin/cursos  (exige perfil TEACHER ou ADMIN)
 *
 * Quem chama: o Next.js (menu "Cursos" do painel).
 * Mostra todos os cursos (inclusive rascunhos) na ordem do catálogo, com botões para reordenar,
 * e o formulário "Novo curso" (que já abre a página do curso criado).
 */
import "server-only";

import { ArrowDown, ArrowUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ActionButton } from "@/components/admin/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/modules/auth/session";
import { moveCourseAction } from "@/modules/catalog/admin/actions";
import { listCoursesForAdmin } from "@/modules/catalog/admin/catalog-admin.server";
import { NewCourseForm } from "@/modules/catalog/admin/components/course-forms";

export const metadata: Metadata = {
  title: "Cursos · Painel admin",
  robots: { index: false },
};

export default async function AdminCoursesPage() {
  await requireRole("TEACHER", "/admin/cursos");
  const courses = await listCoursesForAdmin();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cursos</h1>
        <p className="text-muted-foreground text-sm">
          A ordem abaixo é a ordem do catálogo. Cursos novos começam como rascunho (só a equipe vê).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo curso</CardTitle>
          <CardDescription>Depois de criar, você adiciona módulos, aulas, vídeos e PDFs.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewCourseForm />
        </CardContent>
      </Card>

      {courses.length === 0 ? (
        <p className="text-muted-foreground">Nenhum curso cadastrado ainda.</p>
      ) : (
        <ul className="grid gap-3">
          {courses.map((course, index) => (
            <li key={course.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/cursos/${course.id}`} className="font-medium hover:underline">
                    {course.title}
                  </Link>
                  <Badge variant={course.isPublished ? "default" : "secondary"}>
                    {course.isPublished ? "Publicado" : "Rascunho"}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {course._count.modules} módulo(s) · {course._count.lessons} aula(s) · {course._count.enrollments}{" "}
                  matrícula(s) · /cursos/{course.slug}
                </p>
              </div>
              <div className="flex items-start gap-1">
                <ActionButton
                  action={moveCourseAction}
                  fields={{ id: course.id, direction: "up" }}
                  variant="outline"
                  size="icon"
                  aria-label={`Subir "${course.title}"`}
                  disabled={index === 0}
                >
                  <ArrowUp />
                </ActionButton>
                <ActionButton
                  action={moveCourseAction}
                  fields={{ id: course.id, direction: "down" }}
                  variant="outline"
                  size="icon"
                  aria-label={`Descer "${course.title}"`}
                  disabled={index === courses.length - 1}
                >
                  <ArrowDown />
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
