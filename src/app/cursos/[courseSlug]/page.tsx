/**
 * page.tsx — Página de um curso: /cursos/[curso]  (pública)
 *
 * Quem chama: o Next.js. `[courseSlug]` na pasta = parte variável da URL (o slug do curso).
 *
 * Mostra a descrição e a grade de aulas. Para quem está logado, mostra também o progresso e o
 * botão "Continuar". Para quem não tem acesso: a aula grátis e as OFERTAS (Fase 4) — os produtos
 * à venda que incluem o curso e, se ele faz parte da assinatura, os planos.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatDuration } from "@/lib/format";
import { getCurrentSession } from "@/modules/auth/session";
import { getCourseCurriculum } from "@/modules/catalog/catalog.server";
import { CurriculumList } from "@/modules/catalog/components/curriculum-list";
import { totalDurationSeconds } from "@/modules/catalog/curriculum";
import { CourseOffers } from "@/modules/payments/components/course-offers";
import { getOffersForCourse } from "@/modules/payments/storefront.server";
import type { CourseView } from "@/modules/progress/course-view";
import { getCourseView } from "@/modules/progress/course-view.server";
import { breadcrumbJsonLd, courseJsonLd } from "@/modules/seo/json-ld";
import { JsonLd } from "@/modules/seo/json-ld-script";
import { redirectOldCatalogPathOrNotFound } from "@/modules/seo/redirects.server";
import { SITE_NAME } from "@/modules/seo/site";
import { absoluteUrl, siteUrl } from "@/modules/seo/site.server";

/**
 * Texto do quadro de quem NÃO tem acesso ao curso, conforme a situação da matrícula.
 * Quem já teve acesso precisa saber o que aconteceu (e que o progresso continua guardado).
 */
function accessMessage(view: CourseView, isLoggedIn: boolean, hasOffers: boolean): string {
  // Só sugere a aula grátis quando o curso tem uma (senão o aluno procuraria algo que não existe).
  const freeLessonHint = view.firstFreeLesson
    ? ` Enquanto isso, assista à aula grátis${isLoggedIn ? "" : " (é só criar uma conta)"}.`
    : "";
  switch (view.enrollmentStatus) {
    case "EXPIRED": {
      const endedOn = view.enrollment?.expiresAt ? ` em ${formatDate(view.enrollment.expiresAt)}` : "";
      return `Seu acesso a este curso terminou${endedOn}. Seu progresso fica guardado: ao renovar, você continua de onde parou.`;
    }
    case "REVOKED":
      return "Seu acesso a este curso foi cancelado. Em caso de dúvida, fale com o suporte.";
    case "NOT_STARTED": {
      const startsOn = view.enrollment?.startsAt ? ` em ${formatDate(view.enrollment.startsAt)}` : " em breve";
      return `Sua matrícula começa${startsOn}.${freeLessonHint}`;
    }
    default:
      return hasOffers
        ? `Escolha abaixo como ter acesso ao curso completo.${freeLessonHint}`
        : `As matrículas abrem em breve.${freeLessonHint}`;
  }
}

export async function generateMetadata({ params }: PageProps<"/cursos/[courseSlug]">): Promise<Metadata> {
  const { courseSlug } = await params;
  const course = await getCourseCurriculum(courseSlug);
  if (!course || !course.isPublished) return { title: "Curso" };
  const description = course.subtitle ?? undefined;
  return {
    title: course.title,
    description,
    alternates: { canonical: `/cursos/${course.slug}` },
    openGraph: { title: course.title, description, url: `/cursos/${course.slug}` },
  };
}

export default async function CoursePage({ params }: PageProps<"/cursos/[courseSlug]">) {
  const { courseSlug } = await params; // no Next.js 16, `params` é uma Promise
  const session = await getCurrentSession();
  const view = await getCourseView(
    courseSlug,
    session ? { userId: session.user.id, role: session.user.role } : null,
  );
  if (!view) {
    // Pode ser um endereço ANTIGO (o curso mudou de slug) → redireciona para o atual (Fase 6).
    return redirectOldCatalogPathOrNotFound(courseSlug);
  }

  const { curriculum, orderedLessons, summary } = view;
  const lessonHref = (slug: string) => `/cursos/${curriculum.slug}/aulas/${slug}`;
  // Ofertas só para quem ainda não tem acesso (e só de curso publicado).
  const offers =
    !view.hasCourseAccess && curriculum.isPublished ? await getOffersForCourse(curriculum.id) : { products: [], plans: [] };
  const hasOffers = offers.products.length > 0 || offers.plans.length > 0;

  const courseUrl = absoluteUrl(`/cursos/${curriculum.slug}`);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10">
      {/* Dados estruturados para o Google (Fase 6): o curso e a trilha de navegação. */}
      {curriculum.isPublished ? (
        <JsonLd
          data={[
            courseJsonLd({
              name: curriculum.title,
              description: curriculum.subtitle ?? curriculum.description.slice(0, 300),
              url: courseUrl,
              providerName: SITE_NAME,
              providerUrl: siteUrl(),
            }),
            breadcrumbJsonLd([
              { name: "Início", url: absoluteUrl("/") },
              { name: "Cursos", url: absoluteUrl("/cursos") },
              { name: curriculum.title, url: courseUrl },
            ]),
          ]}
        />
      ) : null}
      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/cursos" className="text-muted-foreground text-sm hover:underline">
            ← Cursos
          </Link>
          {curriculum.isPublished ? null : <Badge variant="secondary">Rascunho</Badge>}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{curriculum.title}</h1>
        {curriculum.subtitle ? <p className="text-muted-foreground text-lg">{curriculum.subtitle}</p> : null}
        <p className="max-w-3xl leading-relaxed">{curriculum.description}</p>
        <p className="text-muted-foreground text-sm">
          {curriculum.modules.length} módulos · {orderedLessons.length} aulas ·{" "}
          {formatDuration(totalDurationSeconds(orderedLessons))}
        </p>

        {view.hasCourseAccess ? (
          <div className="grid max-w-md gap-3 rounded-lg border p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Seu progresso</span>
              <span className="font-medium">
                {summary.completed} de {summary.total} aulas ({summary.percent}%)
              </span>
            </div>
            <Progress value={summary.percent} label="Progresso do curso" />
            {view.resumeLesson ? (
              <Button asChild className="h-auto min-h-9 py-2 text-left whitespace-normal w-fit">
                <Link href={lessonHref(view.resumeLesson.slug)}>
                  {view.hasStarted ? `Continuar: ${view.resumeLesson.title}` : "Começar o curso"}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid max-w-md gap-3">
            <div className="grid gap-3 rounded-lg border p-4">
              <p className="text-sm">{accessMessage(view, Boolean(session), hasOffers)}</p>
              {view.firstFreeLesson ? (
                <Button asChild variant={hasOffers ? "outline" : "default"} className="w-fit">
                  <Link href={lessonHref(view.firstFreeLesson.slug)}>Assistir aula grátis</Link>
                </Button>
              ) : null}
            </div>
            <CourseOffers products={offers.products} plans={offers.plans} />
          </div>
        )}
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">Conteúdo do curso</h2>
        <CurriculumList courseSlug={curriculum.slug} modules={curriculum.modules} lessonStates={view.lessonStates} />
      </section>
    </div>
  );
}
