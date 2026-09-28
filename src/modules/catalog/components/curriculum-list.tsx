/**
 * curriculum-list.tsx — A lista de módulos e aulas de um curso, com ✓ (concluída), 🔒 (bloqueada)
 * ou ▶ (disponível), duração e a etiqueta "Grátis".
 *
 * Quem chama: a página do curso e a barra lateral da página da aula.
 * Componente só de exibição: quem chama já calculou, para cada aula, se está concluída e se a
 * pessoa tem acesso (com `checkLessonAccess`).
 *
 * Aulas bloqueadas também são links: a página da aula explica por que está bloqueada
 * (sem matrícula, acesso vencido etc.), o que é melhor do que um item "morto".
 */
import { CircleCheck, CirclePlay, Lock } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { CurriculumModule, LessonState } from "../curriculum";

type CurriculumListProps = {
  courseSlug: string;
  modules: CurriculumModule[];
  lessonStates: Record<string, LessonState>;
  currentLessonId?: string;
  compact?: boolean; // versão mais enxuta para a barra lateral
};

export function CurriculumList({ courseSlug, modules, lessonStates, currentLessonId, compact = false }: CurriculumListProps) {
  return (
    <ol className="grid gap-4">
      {modules.map((courseModule, moduleIndex) => (
        <li key={courseModule.id} className="grid gap-2">
          <h3 className={cn("font-semibold", compact ? "text-sm" : "text-base")}>
            Módulo {moduleIndex + 1} · {courseModule.title}
          </h3>
          <ol className="divide-y rounded-md border">
            {courseModule.lessons.map((lesson) => {
              const state = lessonStates[lesson.id] ?? { completed: false, accessible: false };
              const isCurrent = lesson.id === currentLessonId;
              return (
                <li key={lesson.id}>
                  <Link
                    href={`/cursos/${courseSlug}/aulas/${lesson.slug}`}
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "hover:bg-accent flex items-center gap-3 px-3 py-2 text-sm",
                      isCurrent && "bg-accent font-medium",
                    )}
                  >
                    <LessonIcon state={state} />
                    <span className="flex-1">
                      {lesson.title}
                      {!lesson.isPublished ? <span className="text-muted-foreground"> (rascunho)</span> : null}
                    </span>
                    {lesson.isFreePreview ? <Badge variant="outline">Grátis</Badge> : null}
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDuration(lesson.durationSeconds)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}

function LessonIcon({ state }: { state: LessonState }) {
  if (state.completed) {
    return <CircleCheck className="size-4 shrink-0 text-green-600" aria-label="Concluída" />;
  }
  if (!state.accessible) {
    return <Lock className="text-muted-foreground size-4 shrink-0" aria-label="Bloqueada" />;
  }
  return <CirclePlay className="text-muted-foreground size-4 shrink-0" aria-label="Disponível" />;
}
