/**
 * page.tsx — Uma trilha de estudo: /trilhas/[slug]  (pública; com login, mostra o progresso)
 *
 * Quem chama: o Next.js (lista de trilhas, páginas de concurso, Google).
 * Mostra: as etapas em ordem (cada uma com quanto o assunto cai na banca), os passos — aulas (✓ feita,
 * ▶ liberada, 🔒 bloqueada) e treinos de questões (X de N questões) —, o próximo passo, a oferta para
 * liberar as aulas e a apresentação da trilha.
 * A trilha NÃO libera aula nenhuma: o cadeado vem da mesma regra das páginas do curso
 * (`checkLessonAccess`, com a matrícula no curso de cada aula). Professor/admin veem RASCUNHOS
 * (prévia sem indexação). Slug antigo → redireciona.
 */
import "server-only";

import { BookOpen, CheckCircle2, ListChecks, Lock, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { Markdown } from "@/lib/markdown/markdown";
import { cn } from "@/lib/utils";
import { loginPath } from "@/modules/auth/redirect";
import { hasMinimumRole } from "@/modules/auth/roles";
import { getCurrentSession } from "@/modules/auth/session";
import { OfferCards } from "@/modules/payments/components/offer-cards";
import { breadcrumbJsonLd } from "@/modules/seo/json-ld";
import { JsonLd } from "@/modules/seo/json-ld-script";
import { redirectOldSlugOrNotFound } from "@/modules/seo/redirects.server";
import { absoluteUrl } from "@/modules/seo/site.server";
import type { TrackItemView } from "@/modules/tracks/rules";
import { getTrackBySlug, getTrackView } from "@/modules/tracks/tracks.server";

async function canSeeDrafts(): Promise<boolean> {
  const session = await getCurrentSession();
  return hasMinimumRole(session?.user.role, "TEACHER");
}

export async function generateMetadata({ params }: PageProps<"/trilhas/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const track = await getTrackBySlug(slug, await canSeeDrafts());
  if (!track) return { title: "Trilha de estudo" };
  const description = track.summary || `Roteiro de estudo de Informática e TI${track.board ? ` para a ${track.board.name}` : ""}: aulas e questões na ordem do que mais cai.`;
  return {
    title: track.title,
    description,
    alternates: { canonical: `/trilhas/${track.slug}` },
    openGraph: { title: track.title, description, url: `/trilhas/${track.slug}` },
    robots: track.isPublished ? undefined : { index: false },
  };
}

export default async function TrackPage({ params }: PageProps<"/trilhas/[slug]">) {
  const { slug } = await params;
  const session = await getCurrentSession();
  const seeDrafts = hasMinimumRole(session?.user.role, "TEACHER");
  const track = await getTrackBySlug(slug, seeDrafts);
  if (!track) return redirectOldSlugOrNotFound("TRACK", slug, { canSeeDrafts: seeDrafts });

  const view = await getTrackView(track.sections, session ? { userId: session.user.id, role: session.user.role } : null);
  const allItems = view.sections.flatMap((section) => section.items);
  const nextItem = allItems.find((item) => item.id === view.nextItemId) ?? null;
  const hasLockedLessons = allItems.some((item) => item.kind === "LESSON" && !item.access.allowed);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-10">
      {track.isPublished ? (
        <JsonLd
          data={breadcrumbJsonLd([
            { name: "Início", url: absoluteUrl("/") },
            { name: "Trilhas", url: absoluteUrl("/trilhas") },
            { name: track.title, url: absoluteUrl(`/trilhas/${track.slug}`) },
          ])}
        />
      ) : null}

      <nav aria-label="Trilha de navegação" className="text-muted-foreground text-sm">
        <Link href="/" className="hover:underline">
          Início
        </Link>{" "}
        ›{" "}
        <Link href="/trilhas" className="hover:underline">
          Trilhas
        </Link>
      </nav>

      {!track.isPublished ? (
        <Alert>
          <AlertDescription>Rascunho: só professores e admins veem esta prévia.</AlertDescription>
        </Alert>
      ) : null}

      <header className="grid gap-3">
        {track.board ? (
          <div>
            <Badge variant="outline">{track.board.name}</Badge>
          </div>
        ) : null}
        <h1 className="text-3xl leading-tight font-semibold tracking-tight">{track.title}</h1>
        {track.summary ? <p className="max-w-3xl leading-relaxed">{track.summary}</p> : null}
      </header>

      <section className="grid gap-3 rounded-lg border p-4" aria-label="Seu progresso">
        {session ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                Você fez {view.summary.done} de {view.summary.total} passos
              </p>
              <span className="text-muted-foreground text-sm">{view.summary.percent}%</span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full" role="progressbar" aria-valuenow={view.summary.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso na trilha">
              <div className="bg-primary h-full" style={{ width: `${view.summary.percent}%` }} />
            </div>
            {nextItem ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Próximo passo:</span>
                <Button asChild size="sm" className="h-auto min-h-8 shrink py-1.5 text-left whitespace-normal">
                  <Link href={nextItem.href}>{itemTitle(nextItem)}</Link>
                </Button>
              </div>
            ) : view.summary.total > 0 ? (
              <p className="text-sm">Parabéns: você concluiu todos os passos desta trilha!</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm">
            <Link href={loginPath(`/trilhas/${track.slug}`)} className="text-primary underline">
              Entre
            </Link>{" "}
            para acompanhar o seu progresso na trilha (aulas concluídas e questões respondidas).
          </p>
        )}
      </section>

      <ol className="grid gap-6">
        {view.sections.map((section, sectionIndex) => {
          const percent = section.subject ? track.percentBySubject.get(section.subject.id) : undefined;
          return (
            <li key={section.id} className="grid gap-3">
              <div className="grid gap-1">
                <h2 className="text-xl font-semibold">
                  Etapa {sectionIndex + 1} — {section.title}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {section.done} de {section.total} passo(s) feitos
                  {percent !== undefined && track.board ? ` · cai em ${String(percent).replace(".", ",")}% das questões da ${track.board.name}` : ""}
                </p>
                {section.description ? <p className="text-sm leading-relaxed">{section.description}</p> : null}
              </div>
              <ol className="grid gap-2">
                {section.items.map((item) => (
                  <li
                    key={item.id}
                    className={cn("grid gap-1 rounded-md border p-3 text-sm", item.id === view.nextItemId && session ? "border-primary ring-primary/30 ring-2" : null)}
                  >
                    <ItemRow item={item} isLoggedIn={Boolean(session)} />
                  </li>
                ))}
                {section.items.length === 0 ? <li className="text-muted-foreground text-sm">Etapa em montagem.</li> : null}
              </ol>
            </li>
          );
        })}
        {view.sections.length === 0 ? <li className="text-muted-foreground text-sm">Esta trilha ainda não tem passos.</li> : null}
      </ol>

      {hasLockedLessons ? (
        <div className="grid gap-3">
          <h2 className="text-xl font-semibold">Para liberar as aulas com cadeado</h2>
          <OfferCards product={track.product} plan={track.plan} label="Para liberar as aulas" />
          {!track.product && !track.plan ? (
            <p className="text-sm">
              Veja os{" "}
              <Link href="/cursos" className="underline">
                cursos
              </Link>{" "}
              e os{" "}
              <Link href="/planos" className="underline">
                planos de assinatura
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      {track.body ? (
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Sobre a trilha</h2>
          <Markdown source={track.body} />
        </section>
      ) : null}
    </div>
  );
}

/** O nome do passo (botão "Próximo passo"). */
function itemTitle(item: TrackItemView): string {
  if (item.kind === "LESSON") return `Assistir: ${item.lesson.title}`;
  return `Treinar ${item.subject.name}${item.board ? ` (${item.board.name})` : ""}`;
}

/**
 * Uma linha da trilha: ícone da situação, o que fazer (link), detalhes e a dica do professor.
 * Aula grátis para quem NÃO entrou: aparece como grátis, mas avisa que é preciso entrar (a regra de
 * acesso vale para quem já está logado — a página da aula pede o login).
 */
function ItemRow({ item, isLoggedIn }: { item: TrackItemView; isLoggedIn: boolean }) {
  if (item.kind === "LESSON") {
    const Icon = item.done ? CheckCircle2 : item.access.allowed ? PlayCircle : Lock;
    const status = item.done ? "Aula concluída" : item.access.allowed ? (isLoggedIn ? "Aula liberada" : "Aula grátis") : "Aula bloqueada";
    const freeNote = isLoggedIn ? " · aula grátis" : " · aula grátis (entre com sua conta para assistir)";
    return (
      <>
        <div className="flex items-start gap-2">
          <Icon className={cn("mt-0.5 size-4 shrink-0", item.done ? "text-green-600 dark:text-green-400" : null)} aria-label={status} />
          <div className="grid min-w-0 gap-0.5">
            <Link href={item.href} className="font-medium hover:underline">
              <BookOpen className="mr-1 inline size-3.5" aria-hidden />
              {item.lesson.title}
            </Link>
            <span className="text-muted-foreground text-xs">
              {item.lesson.course.title}
              {item.lesson.durationSeconds > 0 ? ` · ${formatDuration(item.lesson.durationSeconds)}` : ""}
              {item.access.allowed && item.access.reason === "FREE_PREVIEW" ? freeNote : ""}
              {!item.access.allowed ? " · precisa do curso" : ""}
            </span>
            {item.isDraft ? (
              <span>
                <Badge variant="secondary">Rascunho (o aluno não vê)</Badge>
              </span>
            ) : null}
          </div>
        </div>
        {item.note ? <p className="text-muted-foreground pl-6 text-xs">Dica: {item.note}</p> : null}
      </>
    );
  }
  return (
    <>
      <div className="flex items-start gap-2">
        {item.done ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" aria-label="Treino feito" />
        ) : (
          <ListChecks className="mt-0.5 size-4 shrink-0" aria-label="Treino de questões" />
        )}
        <div className="grid min-w-0 gap-0.5">
          <Link href={item.href} className="font-medium hover:underline">
            Treinar {item.subject.name}
            {item.board ? ` (${item.board.name})` : ""}
          </Link>
          <span className="text-muted-foreground text-xs">
            {Math.min(item.answered, item.goal)} de {item.goal} questões
            {item.accuracyPercent !== null ? ` · ${item.accuracyPercent}% de acerto` : ""}
          </span>
        </div>
      </div>
      {item.note ? <p className="text-muted-foreground pl-6 text-xs">Dica: {item.note}</p> : null}
    </>
  );
}
