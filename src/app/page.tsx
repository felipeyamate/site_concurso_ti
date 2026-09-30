/**
 * page.tsx — Página inicial: /
 *
 * Quem chama: o Next.js, na raiz do site.
 * Mostra: a proposta (TI para concursos, do zero), os diferenciais, os concursos com inscrições
 * abertas/previstos (páginas de edital) e os últimos posts do blog (Fase 6).
 * SEO: endereço canônico e dados estruturados da escola e do site (JSON-LD).
 * `await connection()`: consulta o banco sem ler cookies (regra do CLAUDE.md).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listLatestPosts } from "@/modules/blog/blog.server";
import { PostCard } from "@/modules/blog/components/post-card";
import { NOTICE_STATUS_LABELS } from "@/modules/notices/labels";
import { listPublishedNotices } from "@/modules/notices/notices.server";
import { formatDateOnly } from "@/modules/payments/dates";
import { organizationJsonLd, websiteJsonLd } from "@/modules/seo/json-ld";
import { JsonLd } from "@/modules/seo/json-ld-script";
import { SITE_DESCRIPTION, SITE_NAME } from "@/modules/seo/site";
import { siteUrl } from "@/modules/seo/site.server";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const HIGHLIGHTS: Array<{ title: string; text: string; link?: { href: string; label: string } }> = [
  {
    title: "Linguagem simples",
    text: "TI explicada para quem nunca estudou tecnologia.",
  },
  {
    title: "Foco no que mais cai",
    text: "Conteúdo priorizado pela incidência real nas provas, por banca e por assunto.",
    link: { href: "/o-que-mais-cai", label: "Ver o que mais cai" },
  },
  {
    title: "Prática guiada",
    text: "Questões comentadas, filtráveis por banca, assunto e concurso.",
    link: { href: "/questoes", label: "Resolver questões" },
  },
];

export default async function HomePage({ searchParams }: PageProps<"/">) {
  await connection();
  // Depois de excluir a conta (LGPD), a pessoa chega aqui com ?conta=excluida.
  const accountDeleted = (await searchParams).conta === "excluida";
  const [notices, posts] = await Promise.all([listPublishedNotices(), listLatestPosts(3)]);
  // Concursos que o aluno ainda pode fazer (inscrições abertas ou previstos), até 3.
  const upcoming = notices.filter((notice) => notice.status === "OPEN" || notice.status === "EXPECTED").slice(0, 3);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-12 px-4 py-16">
      <JsonLd
        data={[
          organizationJsonLd({ siteUrl: siteUrl(), name: SITE_NAME, description: SITE_DESCRIPTION }),
          websiteJsonLd({ siteUrl: siteUrl(), name: SITE_NAME }),
        ]}
      />
      {accountDeleted ? (
        <Alert role="status">
          <AlertTitle>Sua conta foi excluída</AlertTitle>
          <AlertDescription>
            Apagamos seus dados de acesso e de estudo. Compras e pagamentos ficam guardados sem o seu nome, pelo prazo da lei fiscal.
          </AlertDescription>
        </Alert>
      ) : null}
      <section className="grid gap-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Informática e TI para concursos, do zero
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
          Garanta os pontos de Informática, TI e Segurança da Informação na sua prova — mesmo
          que você não seja da área.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/cadastro">Criar conta grátis</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/cursos">Ver os cursos</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {HIGHLIGHTS.map((item) => (
          <div key={item.title} className="rounded-xl border p-6">
            <h2 className="mb-2 font-semibold">{item.title}</h2>
            <p className="text-muted-foreground text-sm">{item.text}</p>
            {item.link ? (
              <Link href={item.link.href} className="mt-3 inline-block text-sm underline">
                {item.link.label}
              </Link>
            ) : null}
          </div>
        ))}
      </section>

      {upcoming.length > 0 ? (
        <section className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Concursos com TI no edital</h2>
            <Link href="/concursos" className="text-sm underline">
              Ver todos
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {upcoming.map((notice) => (
              <Link key={notice.id} href={`/concursos/${notice.slug}`} className="hover:bg-muted/50 grid gap-2 rounded-xl border p-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={notice.status === "OPEN" ? "default" : "secondary"}>{NOTICE_STATUS_LABELS[notice.status]}</Badge>
                  {notice.board ? <Badge variant="outline">{notice.board.name}</Badge> : null}
                </div>
                <span className="font-semibold">{notice.title}</span>
                <span className="text-muted-foreground text-sm">
                  {notice.examDate ? `Prova em ${formatDateOnly(notice.examDate)}` : "Data da prova a definir"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {posts.length > 0 ? (
        <section className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Do blog</h2>
            <Link href="/blog" className="text-sm underline">
              Ver todos os posts
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
