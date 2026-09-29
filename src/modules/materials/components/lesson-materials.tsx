/**
 * lesson-materials.tsx — "Material da aula" na página da aula (lado do aluno).
 *
 * Quem chama: a página da aula, SÓ quando a pessoa tem acesso à aula.
 * Os links apontam para a NOSSA rota (/cursos/<curso>/aulas/<aula>/materiais/<id>), que confere o
 * acesso de novo a cada clique e só então manda para o arquivo (link que vence em 5 minutos).
 * O endereço real do arquivo nunca aparece na página.
 */
import { Download, FileText } from "lucide-react";

import { formatFileSize } from "../rules";

type LessonMaterialsProps = {
  courseSlug: string;
  lessonSlug: string;
  attachments: { id: string; title: string; sizeBytes: number }[];
};

export function LessonMaterials({ courseSlug, lessonSlug, attachments }: LessonMaterialsProps) {
  if (attachments.length === 0) return null;
  return (
    <section className="grid gap-2" aria-labelledby="lesson-materials-title">
      <h2 id="lesson-materials-title" className="text-lg font-semibold">
        Material da aula
      </h2>
      <ul className="divide-y rounded-lg border">
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            {/* <a> comum (e não <Link>): o destino é uma rota que redireciona para o arquivo. */}
            <a
              href={`/cursos/${courseSlug}/aulas/${lessonSlug}/materiais/${attachment.id}`}
              target="_blank"
              rel="noopener"
              className="hover:bg-muted flex items-center justify-between gap-3 p-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate font-medium">{attachment.title}</span>
              </span>
              <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                PDF · {formatFileSize(attachment.sizeBytes)}
                <Download className="size-4" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
