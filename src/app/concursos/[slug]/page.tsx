/**
 * page.tsx — Página de um concurso (landing page do edital): /concursos/[slug]  (pública)
 *
 * Quem chama: o Next.js (lista de concursos, Google, anúncios, afiliados).
 * Mostra: situação e datas, o que estudar de TI (com atalho para as questões do assunto na banca),
 * o "o que mais cai" da banca (Fase 5), o texto da página, o edital oficial e a oferta — produto e/ou
 * plano, com o cupom da página já aplicado no botão (`?cupom=`).
 * Professor/admin veem RASCUNHOS (prévia sem indexação). Slug antigo → redireciona.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/lib/markdown/markdown";
import { hasMinimumRole } from "@/modules/auth/roles";
import { getCurrentSession } from "@/modules/auth/session";
import { COUPON_PARAM } from "@/modules/coupons/components/coupon-box";
import { NOTICE_STATUS_LABELS } from "@/modules/notices/labels";
import { getNoticeForViewer } from "@/modules/notices/notices.server";
import { formatDateOnly } from "@/modules/payments/dates";
import { PLAN_CYCLE_PERIOD, accessDaysLabel } from "@/modules/payments/labels";
import { formatBRL } from "@/modules/payments/money";
import { breadcrumbJsonLd } from "@/modules/seo/json-ld";
import { JsonLd } from "@/modules/seo/json-ld-script";
import { redirectOldSlugOrNotFound } from "@/modules/seo/redirects.server";
import { absoluteUrl } from "@/modules/seo/site.server";

async function canSeeDrafts(): Promise<boolean> {
  const session = await getCurrentSession();
  return hasMinimumRole(session?.user.role, "TEACHER");
}

export async function generateMetadata({ params }: PageProps<"/concursos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const notice = await getNoticeForViewer(slug, await canSeeDrafts());
  if (!notice) return { title: "Concurso" };
  const description =
    notice.summary || `O que cai de Informática e TI no concurso ${notice.organization}${notice.role ? ` (${notice.role})` : ""}: datas, banca e como se preparar.`;
  return {
    title: `${notice.title}: o que cai de TI`,
    description,
    alternates: { canonical: `/concursos/${notice.slug}` },
    openGraph: { title: notice.title, description, url: `/concursos/${notice.slug}` },
    robots: notice.isPublished ? undefined : { index: false },
  };
}

export default async function NoticePage({ params }: PageProps<"/concursos/[slug]">) {
  const { slug } = await params;
  const notice = await getNoticeForViewer(slug, await canSeeDrafts());
  if (!notice) {
    // Endereço antigo (o slug mudou): leva ao atual (rascunho só para quem vê rascunhos).
    return redirectOldSlugOrNotFound("EXAM_NOTICE", slug, { canSeeDrafts: await canSeeDrafts() });
  }
  // O cupom só vai no link da oferta para a qual ele VALE (conferido em `getNoticeForViewer`).
  const withCoupon = (path: string, coupon: OfferCoupon | null) => (coupon ? `${path}?${COUPON_PARAM}=${encodeURIComponent(coupon.code)}` : path);
  const facts = [
    ["Situação", NOTICE_STATUS_LABELS[notice.status]],
    ["Banca", notice.board?.name ?? "A definir"],
    ["Inscrições até", notice.registrationEndsOn ? formatDateOnly(notice.registrationEndsOn) : "A definir"],
    ["Prova", notice.examDate ? formatDateOnly(notice.examDate) : "A definir"],
    ...(notice.vacancies ? [["Vagas", notice.vacancies]] : []),
    ...(notice.salary ? [["Salário", notice.salary]] : []),
  ];
  const hasOffers = Boolean(notice.product || notice.plan);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-10">
      {notice.isPublished ? (
        <JsonLd
          data={breadcrumbJsonLd([
            { name: "Início", url: absoluteUrl("/") },
            { name: "Concursos", url: absoluteUrl("/concursos") },
            { name: notice.title, url: absoluteUrl(`/concursos/${notice.slug}`) },
          ])}
        />
      ) : null}

      <nav aria-label="Trilha" className="text-muted-foreground text-sm">
        <Link href="/" className="hover:underline">
          Início
        </Link>{" "}
        ›{" "}
        <Link href="/concursos" className="hover:underline">
          Concursos
        </Link>
      </nav>

      {!notice.isPublished ? (
        <Alert>
          <AlertDescription>Rascunho: só professores e admins veem esta prévia.</AlertDescription>
        </Alert>
      ) : null}

      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={notice.status === "OPEN" ? "default" : "secondary"}>{NOTICE_STATUS_LABELS[notice.status]}</Badge>
          {notice.board ? <Badge variant="outline">{notice.board.name}</Badge> : null}
        </div>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight">{notice.title}</h1>
        <p className="text-muted-foreground text-lg">
          {notice.organization}
          {notice.role ? ` · ${notice.role}` : ""}
        </p>
        {notice.summary ? <p className="max-w-3xl leading-relaxed">{notice.summary}</p> : null}
      </header>

      <dl className="grid gap-3 sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-lg border p-3">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {hasOffers ? (
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Como se preparar">
          {notice.product ? (
            <Card>
              <CardHeader>
                <CardTitle>{notice.product.title}</CardTitle>
                <CardDescription>
                  <OfferPrice priceCents={notice.product.priceCents} coupon={notice.product.coupon} /> · acesso{" "}
                  {accessDaysLabel(notice.product.accessDays)}
                  {notice.product.maxInstallments > 1 ? ` · até ${notice.product.maxInstallments}x no cartão` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <CouponNote coupon={notice.product.coupon} />
                <Button asChild>
                  <Link href={withCoupon(`/comprar/${notice.product.slug}`, notice.product.coupon)}>Quero me preparar</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {notice.plan ? (
            <Card>
              <CardHeader>
                <CardTitle>{notice.plan.title}</CardTitle>
                <CardDescription>
                  <OfferPrice priceCents={notice.plan.priceCents} coupon={notice.plan.coupon} /> {PLAN_CYCLE_PERIOD[notice.plan.cycle]} · todos
                  os cursos da assinatura
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <CouponNote coupon={notice.plan.coupon} />
                <Button asChild variant={notice.product ? "outline" : "default"}>
                  <Link href={withCoupon(`/assinar/${notice.plan.slug}`, notice.plan.coupon)}>Assinar</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {notice.subjects.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">O que estudar de TI para este concurso</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {notice.subjects.map((subject) => (
              <li key={subject.id} className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
                <span>{subject.name}</span>
                <Link
                  href={`/questoes?assunto=${subject.slug}${notice.board ? `&banca=${notice.board.slug}` : ""}`}
                  className="text-primary shrink-0 underline"
                >
                  Treinar questões
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {notice.board && notice.topSubjects.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">O que mais cai na {notice.board.name}</h2>
          <p className="text-muted-foreground text-sm">Das {notice.incidenceTotal} questões de provas anteriores da banca que analisamos:</p>
          <ol className="grid gap-1 text-sm">
            {notice.topSubjects.map((subject, index) => (
              <li key={subject.subjectId}>
                {index + 1}. {subject.name} — <strong>{String(subject.percent).replace(".", ",")}%</strong>
              </li>
            ))}
          </ol>
          <Link href={`/o-que-mais-cai?banca=${notice.board.slug}`} className="text-primary text-sm underline">
            Ver o mapa completo da {notice.board.name}
          </Link>
        </section>
      ) : null}

      {notice.body ? (
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Sobre o concurso</h2>
          <Markdown source={notice.body} />
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {notice.officialUrl ? (
          <Button asChild variant="outline">
            <a href={notice.officialUrl} target="_blank" rel="noopener noreferrer">
              Edital oficial
            </a>
          </Button>
        ) : null}
        {/* Texto longo: o botão encolhe e quebra a linha (o padrão `shrink-0` + `whitespace-nowrap` alargava a página no celular). */}
        <Button asChild variant="ghost" className="h-auto min-h-9 shrink py-2 text-left whitespace-normal">
          <Link href="/cadastro">Criar conta grátis e treinar 10 questões por dia</Link>
        </Button>
      </div>
    </div>
  );
}

type OfferCoupon = { code: string; finalPriceCents: number };

/** Preço da oferta: com o cupom valendo, o antigo riscado e o novo. */
function OfferPrice({ priceCents, coupon }: { priceCents: number; coupon: OfferCoupon | null }) {
  if (!coupon) return <>{formatBRL(priceCents)}</>;
  return (
    <>
      <span className="line-through">{formatBRL(priceCents)}</span> <strong className="text-foreground">{formatBRL(coupon.finalPriceCents)}</strong>
    </>
  );
}

function CouponNote({ coupon }: { coupon: OfferCoupon | null }) {
  if (!coupon) return null;
  return (
    <p className="text-sm">
      Com o cupom <strong>{coupon.code}</strong> já aplicado.
    </p>
  );
}
