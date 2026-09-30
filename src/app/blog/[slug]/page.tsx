/**
 * page.tsx — Um post do blog: /blog/[slug]  (público)
 *
 * Quem chama: o Next.js (lista do blog, Google, links compartilhados).
 * Mostra o texto (Markdown seguro), data, autor, tempo de leitura, o atalho para treinar questões do
 * assunto do post e posts relacionados. Para o Google: dados estruturados (artigo + trilha).
 * Professor/admin veem RASCUNHOS (prévia, com aviso e sem indexação). Slug antigo → redireciona.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/lib/markdown/markdown";
import { readingMinutes } from "@/lib/markdown/parse";
import { hasMinimumRole } from "@/modules/auth/roles";
import { getCurrentSession } from "@/modules/auth/session";
import { getPostForViewer, listRelatedPosts, postSummary } from "@/modules/blog/blog.server";
import { PostCard } from "@/modules/blog/components/post-card";
import { articleJsonLd, breadcrumbJsonLd } from "@/modules/seo/json-ld";
import { JsonLd } from "@/modules/seo/json-ld-script";
import { redirectOldSlugOrNotFound } from "@/modules/seo/redirects.server";
import { SITE_NAME } from "@/modules/seo/site";
import { absoluteUrl, siteUrl } from "@/modules/seo/site.server";

async function canSeeDrafts(): Promise<boolean> {
  const session = await getCurrentSession();
  return hasMinimumRole(session?.user.role, "TEACHER");
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostForViewer(slug, await canSeeDrafts());
  if (!post) return { title: "Blog" };
  const description = postSummary(post);
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
    },
    // Rascunho (prévia do professor) nunca vai para o Google.
    robots: post.isPublished ? undefined : { index: false },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPostForViewer(slug, await canSeeDrafts());
  if (!post) {
    // Endereço antigo (o slug mudou): leva ao atual (rascunho só para quem vê rascunhos).
    return redirectOldSlugOrNotFound("BLOG_POST", slug, { canSeeDrafts: await canSeeDrafts() });
  }
  const related = await listRelatedPosts({ id: post.id, subjectId: post.subjectId });
  const url = absoluteUrl(`/blog/${post.slug}`);

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      {post.isPublished ? (
        <JsonLd
          data={[
            articleJsonLd({
              headline: post.title,
              description: postSummary(post),
              url,
              datePublished: (post.publishedAt ?? post.updatedAt).toISOString(),
              dateModified: post.updatedAt.toISOString(),
              authorName: post.author?.name ?? null,
              publisherName: SITE_NAME,
              publisherUrl: siteUrl(),
            }),
            breadcrumbJsonLd([
              { name: "Início", url: absoluteUrl("/") },
              { name: "Blog", url: absoluteUrl("/blog") },
              { name: post.title, url },
            ]),
          ]}
        />
      ) : null}

      <nav aria-label="Trilha" className="text-muted-foreground text-sm">
        <Link href="/" className="hover:underline">
          Início
        </Link>{" "}
        ›{" "}
        <Link href="/blog" className="hover:underline">
          Blog
        </Link>
      </nav>

      {!post.isPublished ? (
        <Alert>
          <AlertDescription>Rascunho: só professores e admins veem esta prévia.</AlertDescription>
        </Alert>
      ) : null}

      <header className="grid gap-3">
        <h1 className="text-3xl leading-tight font-semibold tracking-tight">{post.title}</h1>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          {post.publishedAt ? <span>{formatDate(post.publishedAt)}</span> : null}
          {post.author ? <span>· por {post.author.name}</span> : null}
          <span>· {readingMinutes(post.body)} min de leitura</span>
          {post.subject ? <Badge variant="secondary">{post.subject.name}</Badge> : null}
        </div>
      </header>

      <Markdown source={post.body} />

      <Card>
        <CardHeader>
          <CardTitle>Agora, pratique</CardTitle>
          <CardDescription>
            Ler ajuda; resolver questões é o que garante o ponto na prova. Crie sua conta grátis e resolva 10 questões comentadas por dia.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {/* O nome do assunto pode ser longo: o botão encolhe e quebra a linha (o padrão `shrink-0` + `whitespace-nowrap`
              alargava a página no celular). */}
          <Button asChild className="h-auto min-h-9 shrink py-2 text-left whitespace-normal">
            <Link href={post.subject ? `/questoes?assunto=${post.subject.slug}` : "/questoes"}>
              {post.subject ? `Questões de ${post.subject.name}` : "Resolver questões"}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/cursos">Conhecer os cursos</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/o-que-mais-cai">O que mais cai</Link>
          </Button>
        </CardContent>
      </Card>

      {related.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Leia também</h2>
          <div className="grid gap-3">
            {related.map((item) => (
              <PostCard key={item.id} post={item} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
