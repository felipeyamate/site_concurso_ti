/**
 * page.tsx — Editar uma aula no painel: /admin/cursos/[id]/aulas/[aulaId]  (exige TEACHER ou ADMIN)
 *
 * Quem chama: o Next.js (link na grade do curso, ou depois de "Adicionar aula").
 * Mostra:
 *  1. dados da aula (título, endereço, módulo, resumo, grátis, publicada);
 *  2. o vídeo (Panda: colar o link ou escolher da biblioteca; sem vídeo; exemplo em desenvolvimento);
 *  3. os materiais em PDF (enviar e apagar);
 *  4. apagar a aula (só se nenhum aluno assistiu).
 */
import "server-only";

import { ExternalLink, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/admin/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { isProductionSite } from "@/lib/runtime";
import { requireRole } from "@/modules/auth/session";
import { deleteLessonAction } from "@/modules/catalog/admin/actions";
import { countStudentProgress, getLessonForAdmin } from "@/modules/catalog/admin/catalog-admin.server";
import { LessonDetailsForm } from "@/modules/catalog/admin/components/lesson-forms";
import { LessonVideoForm } from "@/modules/catalog/admin/components/lesson-video-form";
import type { VideoSource } from "@/modules/catalog/admin/schemas";
import { AttachmentManager } from "@/modules/materials/components/attachment-manager";
import { getStorageKind } from "@/modules/storage/storage.server";

type AdminLessonPageProps = PageProps<"/admin/cursos/[courseId]/aulas/[lessonId]">;

export const metadata: Metadata = {
  title: "Editar aula · Painel admin",
  robots: { index: false },
};

export default async function AdminLessonPage({ params }: AdminLessonPageProps) {
  const { courseId, lessonId } = await params;
  await requireRole("TEACHER", `/admin/cursos/${courseId}/aulas/${lessonId}`);
  const lesson = await getLessonForAdmin(lessonId);
  // A aula precisa ser do curso do endereço (evita editar pelo "caminho errado").
  if (!lesson || lesson.courseId !== courseId) notFound();

  const videoSource: VideoSource = !lesson.videoId ? "NONE" : lesson.videoProvider;
  const studentsWatched = await countStudentProgress(lesson.id, lesson.courseId);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <Link href={`/admin/cursos/${courseId}`} className="text-muted-foreground text-sm hover:underline">
          ← {lesson.course.title}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
            <Badge variant={lesson.isPublished ? "default" : "secondary"}>
              {lesson.isPublished ? "Publicada" : "Rascunho"}
            </Badge>
            {lesson.isFreePreview ? <Badge variant="outline">Grátis</Badge> : null}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/cursos/${lesson.course.slug}/aulas/${lesson.slug}`} target="_blank">
              Ver como aluno
              <ExternalLink />
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da aula</CardTitle>
        </CardHeader>
        <CardContent>
          <LessonDetailsForm lesson={lesson} courseSlug={lesson.course.slug} modules={lesson.course.modules} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vídeo</CardTitle>
          <CardDescription>
            O aluno assiste pelo player do Panda, com a marca d&apos;água dele (nome, e-mail e ID) dentro do vídeo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LessonVideoForm
            lessonId={lesson.id}
            initialSource={videoSource}
            initialPandaEmbed={lesson.videoEmbedUrl ?? ""}
            initialDurationSeconds={lesson.durationSeconds}
            pandaLibraryEnabled={Boolean(env.PANDA_API_KEY)}
            devVideoAllowed={!isProductionSite()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Materiais (PDF)</CardTitle>
          <CardDescription>
            Aparecem embaixo do vídeo para quem tem acesso à aula. Cada download confere o acesso e gera um link que vale 5
            minutos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttachmentManager
            lessonId={lesson.id}
            attachments={lesson.attachments}
            storageAvailable={getStorageKind() !== null}
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Apagar aula</CardTitle>
          <CardDescription>
            {studentsWatched > 0
              ? `${studentsWatched} aluno(s) já assistiram esta aula: ela não pode ser apagada. Para tirar do ar, desmarque "Publicada".`
              : "Apaga a aula e os PDFs dela. Isso não pode ser desfeito."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionButton
            action={deleteLessonAction}
            fields={{ id: lesson.id }}
            variant="destructive"
            disabled={studentsWatched > 0}
            confirmMessage={`Apagar a aula "${lesson.title}" e os PDFs dela?`}
          >
            <Trash2 />
            Apagar aula
          </ActionButton>
        </CardContent>
      </Card>
    </div>
  );
}
