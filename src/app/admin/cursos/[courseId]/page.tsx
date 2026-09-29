/**
 * page.tsx — Editar um curso no painel: /admin/cursos/[id]  (exige perfil TEACHER ou ADMIN)
 *
 * Quem chama: o Next.js (link na lista de cursos, ou depois de "Criar curso").
 * Mostra:
 *  1. dados do curso (título, endereço, descrição, publicado);
 *  2. a grade: módulos (renomear, ↑↓, apagar vazio) e aulas (↑↓, abrir para editar, nova aula);
 *  3. "zona de perigo": apagar o curso (só sem matrículas e sem histórico de alunos).
 */
import "server-only";

import { ArrowDown, ArrowUp, ExternalLink, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/admin/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";
import { requireRole } from "@/modules/auth/session";
import {
  deleteCourseAction,
  deleteModuleAction,
  moveLessonAction,
  moveModuleAction,
} from "@/modules/catalog/admin/actions";
import { getCourseForAdmin } from "@/modules/catalog/admin/catalog-admin.server";
import { CourseDetailsForm } from "@/modules/catalog/admin/components/course-forms";
import { ModuleTitleForm, NewLessonForm, NewModuleForm } from "@/modules/catalog/admin/components/module-forms";

type AdminCoursePageProps = PageProps<"/admin/cursos/[courseId]">;

export const metadata: Metadata = {
  title: "Editar curso · Painel admin",
  robots: { index: false },
};

export default async function AdminCoursePage({ params }: AdminCoursePageProps) {
  const { courseId } = await params;
  await requireRole("TEACHER", `/admin/cursos/${courseId}`);
  const course = await getCourseForAdmin(courseId);
  if (!course) notFound();

  const lessonCount = course.modules.reduce((sum, item) => sum + item.lessons.length, 0);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <Link href="/admin/cursos" className="text-muted-foreground text-sm hover:underline">
          ← Cursos
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
            <Badge variant={course.isPublished ? "default" : "secondary"}>
              {course.isPublished ? "Publicado" : "Rascunho"}
            </Badge>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/cursos/${course.slug}`} target="_blank">
              Ver no site
              <ExternalLink />
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do curso</CardTitle>
        </CardHeader>
        <CardContent>
          <CourseDetailsForm course={course} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grade do curso</CardTitle>
          <CardDescription>
            {course.modules.length} módulo(s) · {lessonCount} aula(s). Aulas novas começam como rascunho: publique cada uma
            quando estiver pronta.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {course.modules.map((courseModule, moduleIndex) => (
            <section key={courseModule.id} className="grid gap-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start gap-2">
                <ModuleTitleForm moduleId={courseModule.id} title={courseModule.title} number={moduleIndex + 1} />
                <div className="flex items-start gap-1 pt-5">
                  <ActionButton
                    action={moveModuleAction}
                    fields={{ id: courseModule.id, direction: "up" }}
                    variant="outline"
                    size="icon"
                    aria-label={`Subir o módulo "${courseModule.title}"`}
                    disabled={moduleIndex === 0}
                  >
                    <ArrowUp />
                  </ActionButton>
                  <ActionButton
                    action={moveModuleAction}
                    fields={{ id: courseModule.id, direction: "down" }}
                    variant="outline"
                    size="icon"
                    aria-label={`Descer o módulo "${courseModule.title}"`}
                    disabled={moduleIndex === course.modules.length - 1}
                  >
                    <ArrowDown />
                  </ActionButton>
                  <ActionButton
                    action={deleteModuleAction}
                    fields={{ id: courseModule.id }}
                    variant="outline"
                    size="icon"
                    aria-label={`Apagar o módulo "${courseModule.title}"`}
                    confirmMessage={`Apagar o módulo "${courseModule.title}"?`}
                  >
                    <Trash2 />
                  </ActionButton>
                </div>
              </div>

              {courseModule.lessons.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma aula neste módulo.</p>
              ) : (
                <ol className="divide-y rounded-md border">
                  {courseModule.lessons.map((lesson, lessonIndex) => (
                    <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-2 p-2 pl-3">
                      <div className="grid min-w-0 gap-1">
                        <Link
                          href={`/admin/cursos/${course.id}/aulas/${lesson.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {moduleIndex + 1}.{lessonIndex + 1} {lesson.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1">
                          {!lesson.isPublished ? <Badge variant="secondary">Rascunho</Badge> : null}
                          {lesson.isFreePreview ? <Badge variant="outline">Grátis</Badge> : null}
                          {!lesson.videoId ? (
                            <Badge variant="outline">Sem vídeo</Badge>
                          ) : lesson.videoProvider === "DEV" ? (
                            <Badge variant="outline">Vídeo de exemplo</Badge>
                          ) : null}
                          {lesson._count.attachments > 0 ? (
                            <Badge variant="outline">{lesson._count.attachments} PDF(s)</Badge>
                          ) : null}
                          {lesson.durationSeconds > 0 ? (
                            <span className="text-muted-foreground text-xs">{formatDuration(lesson.durationSeconds)}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-start gap-1">
                        <ActionButton
                          action={moveLessonAction}
                          fields={{ id: lesson.id, direction: "up" }}
                          variant="ghost"
                          size="icon"
                          aria-label={`Subir a aula "${lesson.title}"`}
                          disabled={lessonIndex === 0}
                        >
                          <ArrowUp />
                        </ActionButton>
                        <ActionButton
                          action={moveLessonAction}
                          fields={{ id: lesson.id, direction: "down" }}
                          variant="ghost"
                          size="icon"
                          aria-label={`Descer a aula "${lesson.title}"`}
                          disabled={lessonIndex === courseModule.lessons.length - 1}
                        >
                          <ArrowDown />
                        </ActionButton>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <NewLessonForm moduleId={courseModule.id} />
            </section>
          ))}

          <NewModuleForm courseId={course.id} />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Apagar curso</CardTitle>
          <CardDescription>
            Apaga o curso, todos os módulos, aulas e PDFs. Só é possível se ninguém tiver matrícula
            {course._count.enrollments > 0 ? ` (este curso tem ${course._count.enrollments})` : ""} e nenhum aluno tiver
            assistido às aulas. Para tirar do ar sem perder nada, desmarque &quot;Publicado&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionButton
            action={deleteCourseAction}
            fields={{ id: course.id }}
            variant="destructive"
            confirmMessage={`Apagar o curso "${course.title}" com todas as aulas e PDFs? Isso não pode ser desfeito.`}
          >
            <Trash2 />
            Apagar curso
          </ActionButton>
        </CardContent>
      </Card>
    </div>
  );
}
