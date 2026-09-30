/**
 * page.tsx — Página da aula: /cursos/[curso]/aulas/[aula]  (exige login)
 *
 * Quem chama: o Next.js. Antes, o `proxy.ts` já mandou para o login quem não tem cookie.
 *
 * Passos:
 *  1. Exige login (requireSession) e monta a visão do curso para esta pessoa.
 *  2. Acha a aula; se não existe (ou é rascunho para aluno), "página não encontrada".
 *  3. Confere o ACESSO (matrícula ativa, aula grátis ou professor/admin).
 *     - Sem acesso: mostra o motivo e o caminho (aula grátis / página do curso). Nada de vídeo.
 *     - Com acesso: SÓ ENTÃO pede o vídeo ao provedor (link do vídeo nunca sai sem acesso)
 *       e lista os materiais em PDF (cada download confere o acesso de novo).
 *  4. Mostra player (continuando de onde parou), materiais, descrição, concluir, anterior/próxima
 *     e a grade.
 */
import "server-only";

import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDuration } from "@/lib/format";
import { hasMinimumRole } from "@/modules/auth/roles";
import { requireSession } from "@/modules/auth/session";
import { getCourseCurriculum, getLessonVideo } from "@/modules/catalog/catalog.server";
import { CurriculumList } from "@/modules/catalog/components/curriculum-list";
import { findAdjacentLessons } from "@/modules/catalog/curriculum";
import { LOCKED_LESSON_MESSAGES } from "@/modules/enrollment/access";
import { LessonMaterials } from "@/modules/materials/components/lesson-materials";
import { listLessonAttachments } from "@/modules/materials/materials.server";
import { CompletionToggle } from "@/modules/progress/components/completion-toggle";
import { LessonPlayer } from "@/modules/progress/components/lesson-player";
import { getCourseView } from "@/modules/progress/course-view.server";
import { getResumePosition } from "@/modules/progress/rules";
import { redirectOldCatalogPathOrNotFound } from "@/modules/seo/redirects.server";
import { getLessonPlayback } from "@/modules/video/provider";
import type { VideoPlayback } from "@/modules/video/types";

type LessonPageProps = PageProps<"/cursos/[courseSlug]/aulas/[lessonSlug]">;

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  const { courseSlug, lessonSlug } = await params;
  const course = await getCourseCurriculum(courseSlug);
  const lesson = course?.modules.flatMap((item) => item.lessons).find((item) => item.slug === lessonSlug);
  // Rascunhos não revelam o título nem na aba do navegador (a página em si dá 404 para alunos).
  const isPublic = Boolean(course?.isPublished && lesson?.isPublished);
  return {
    title: isPublic && lesson && course ? `${lesson.title} · ${course.title}` : "Aula",
    robots: { index: false }, // aulas são área do aluno: fora do Google
  };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseSlug, lessonSlug } = await params;
  const pagePath = `/cursos/${courseSlug}/aulas/${lessonSlug}`;

  // 1. Login + visão do curso.
  const { user } = await requireSession(pagePath);
  const view = await getCourseView(courseSlug, { userId: user.id, role: user.role });
  // Não achou: pode ser um endereço ANTIGO (curso ou aula mudou de slug) → redireciona (Fase 6).
  const canSeeDrafts = hasMinimumRole(user.role, "TEACHER");
  if (!view) return redirectOldCatalogPathOrNotFound(courseSlug, lessonSlug, { canSeeDrafts });

  // 2. A aula.
  const lesson = view.orderedLessons.find((item) => item.slug === lessonSlug);
  if (!lesson) return redirectOldCatalogPathOrNotFound(courseSlug, lessonSlug, { canSeeDrafts });

  const courseModule = view.curriculum.modules.find((item) => item.lessons.some((l) => l.id === lesson.id));
  const moduleNumber = courseModule ? view.curriculum.modules.indexOf(courseModule) + 1 : null;
  const { previous, next } = findAdjacentLessons(view.orderedLessons, lesson.id);
  const access = view.accessByLesson[lesson.id];
  const lessonHref = (slug: string) => `/cursos/${view.curriculum.slug}/aulas/${slug}`;

  // 3 e 4. Conteúdo principal: bloqueado ou player.
  let main: ReactNode;
  if (!access.allowed) {
    main = (
      <Alert>
        <Lock />
        <AlertTitle>Aula bloqueada</AlertTitle>
        <AlertDescription>
          <p>{LOCKED_LESSON_MESSAGES[access.reason]}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            {view.firstFreeLesson && view.firstFreeLesson.id !== lesson.id ? (
              <Button asChild size="sm">
                <Link href={lessonHref(view.firstFreeLesson.slug)}>Assistir aula grátis</Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href={`/cursos/${view.curriculum.slug}`}>Ver o curso</Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  } else {
    const [video, attachments] = await Promise.all([getLessonVideo(lesson.id), listLessonAttachments(lesson.id)]);
    // Se o fornecedor de vídeo falhar, a página continua de pé (título, grade, navegação) e
    // mostra "vídeo indisponível". O erro vai para o log do servidor (Sentry, na Fase 7).
    let playback: VideoPlayback | null = null;
    let playbackFailed = false;
    if (video) {
      try {
        playback = await getLessonPlayback(video, { id: user.id, name: user.name, email: user.email });
      } catch (error) {
        console.error(`Falha ao obter o vídeo da aula ${lesson.id}:`, error);
        playbackFailed = true;
      }
    }
    const progress = view.progressByLesson.get(lesson.id);
    const completed = Boolean(progress?.completedAt);
    const initialPositionSeconds = progress
      ? getResumePosition({
          positionSeconds: progress.positionSeconds,
          durationSeconds: progress.durationSeconds,
          completed,
        })
      : 0;

    main = (
      <div className="grid gap-4">
        {playback ? (
          <LessonPlayer
            // `key`: ao trocar de aula, o player é recriado do zero (sem herdar nada da aula anterior).
            key={lesson.id}
            lessonId={lesson.id}
            lessonTitle={lesson.title}
            playback={playback}
            watermarkText={user.email}
            initialPositionSeconds={initialPositionSeconds}
            initiallyCompleted={completed}
          />
        ) : (
          <div className="text-muted-foreground flex aspect-video items-center justify-center rounded-lg border p-4 text-center">
            {playbackFailed
              ? "O vídeo desta aula está indisponível no momento. Tente novamente mais tarde."
              : "Esta aula não tem vídeo."}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CompletionToggle lessonId={lesson.id} completed={completed} />
          {initialPositionSeconds > 0 ? (
            <span className="text-muted-foreground text-sm">
              Continuando de onde você parou ({formatDuration(initialPositionSeconds)}).
            </span>
          ) : null}
        </div>
        <LessonMaterials courseSlug={view.curriculum.slug} lessonSlug={lesson.slug} attachments={attachments} />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_340px]">
      <div className="grid content-start gap-6">
        <div className="grid gap-1">
          <Link href={`/cursos/${view.curriculum.slug}`} className="text-muted-foreground text-sm hover:underline">
            ← {view.curriculum.title}
          </Link>
          {moduleNumber && courseModule ? (
            <p className="text-muted-foreground text-sm">
              Módulo {moduleNumber} · {courseModule.title}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
            {lesson.isFreePreview ? <Badge variant="outline">Aula grátis</Badge> : null}
          </div>
        </div>

        {main}

        {lesson.description ? <p className="leading-relaxed">{lesson.description}</p> : null}

        <nav className="flex flex-wrap justify-between gap-2" aria-label="Navegação entre aulas">
          {previous ? (
            <Button asChild variant="outline">
              <Link href={lessonHref(previous.slug)}>
                <ChevronLeft />
                Anterior
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {next ? (
            <Button asChild className="h-auto min-h-9 py-2 text-left whitespace-normal">
              <Link href={lessonHref(next.slug)}>
                Próxima: {next.title}
                <ChevronRight />
              </Link>
            </Button>
          ) : null}
        </nav>
      </div>

      <aside className="grid content-start gap-4">
        {view.hasCourseAccess ? (
          <div className="grid gap-2 rounded-lg border p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Progresso do curso</span>
              <span className="font-medium">{view.summary.percent}%</span>
            </div>
            <Progress value={view.summary.percent} label="Progresso do curso" />
          </div>
        ) : null}
        <CurriculumList
          courseSlug={view.curriculum.slug}
          modules={view.curriculum.modules}
          lessonStates={view.lessonStates}
          currentLessonId={lesson.id}
          compact
        />
      </aside>
    </div>
  );
}
