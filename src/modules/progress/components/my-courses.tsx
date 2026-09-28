/**
 * my-courses.tsx — Bloco "Meus cursos" da área do aluno: cada curso com o progresso e o botão
 * "Continuar de onde parou".
 *
 * Quem chama: `src/app/area-do-aluno/page.tsx`, que já buscou as visões dos cursos
 * (`listMyCourseViews`). Componente só de exibição.
 */
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import type { CourseView } from "../course-view";

export function MyCourses({ courses }: { courses: CourseView[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Meus cursos</CardTitle>
        <CardDescription>Continue de onde parou.</CardDescription>
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          <div className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Você ainda não está matriculado em nenhum curso. Enquanto as matrículas não abrem, assista às
              aulas grátis.
            </p>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/cursos">Ver os cursos</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4">
            {courses.map((view) => {
              const { curriculum, summary, resumeLesson } = view;
              return (
                <li key={curriculum.id} className="grid gap-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/cursos/${curriculum.slug}`} className="font-medium hover:underline">
                      {curriculum.title}
                    </Link>
                    {curriculum.isPublished ? null : <Badge variant="secondary">Rascunho</Badge>}
                  </div>
                  <div className="grid gap-1">
                    <Progress value={summary.percent} label={`Progresso em ${curriculum.title}`} />
                    <span className="text-muted-foreground text-xs">
                      {summary.completed} de {summary.total} aulas concluídas ({summary.percent}%)
                    </span>
                  </div>
                  {resumeLesson ? (
                    <Button asChild size="sm" className="h-auto min-h-9 py-2 text-left whitespace-normal w-fit">
                      <Link href={`/cursos/${curriculum.slug}/aulas/${resumeLesson.slug}`}>
                        {view.hasStarted ? `Continuar: ${resumeLesson.title}` : "Começar o curso"}
                      </Link>
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
