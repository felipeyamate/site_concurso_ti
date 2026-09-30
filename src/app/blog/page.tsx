/**
 * page.tsx — Blog: /blog  (público; ?pagina=2 para as próximas)
 *
 * Quem chama: o Next.js (rodapé, página inicial, Google).
 * Lista os posts publicados, mais novos primeiro, 10 por página.
 * `await connection()`: a página consulta o banco sem ler cookies — sem isto o `next build`
 * tentaria montá-la sem banco (regra do CLAUDE.md).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { listPublishedPosts } from "@/modules/blog/blog.server";
import { PostCard } from "@/modules/blog/components/post-card";
import { SITE_NAME } from "@/modules/seo/site";

/** "?pagina=3" → 3 (qualquer outra coisa → 1). */
function requestedPage(value: string | string[] | undefined): number {
  const page = Number(typeof value === "string" ? value : "1");
  return Number.isInteger(page) && page > 1 ? page : 1;
}

/**
 * Metadados por página: cada página da lista tem o SEU endereço canônico (/blog, /blog?pagina=2...).
 * Com "/blog" em todas, o Google trataria as páginas 2, 3... como cópias da primeira e não as leria.
 */
export async function generateMetadata({ searchParams }: PageProps<"/blog">): Promise<Metadata> {
  const page = requestedPage((await searchParams).pagina);
  return {
    title: page > 1 ? `Blog (página ${page})` : "Blog: Informática e TI para concursos, sem complicação",
    description: "Artigos em linguagem simples sobre os assuntos de TI que mais caem em concursos: segurança, redes, Office, sistemas operacionais e mais.",
    alternates: {
      canonical: page > 1 ? `/blog?pagina=${page}` : "/blog",
      types: { "application/rss+xml": [{ url: "/blog/rss.xml", title: `Blog ${SITE_NAME}` }] },
    },
  };
}

export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  await connection();
  const { posts, page, pageCount } = await listPublishedPosts(requestedPage((await searchParams).pagina));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
        <p className="text-muted-foreground">
          TI para concursos explicada para quem nunca estudou TI. Quer praticar? <Link href="/questoes" className="underline">Resolva questões comentadas</Link>.
        </p>
      </div>
      {posts.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum post publicado ainda.</p>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      {pageCount > 1 ? (
        <nav aria-label="Páginas do blog" className="flex flex-wrap items-center gap-3 text-sm">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={page === 2 ? "/blog" : `/blog?pagina=${page - 1}`}>← Mais novos</Link>
            </Button>
          ) : null}
          <span className="text-muted-foreground">
            Página {page} de {pageCount}
          </span>
          {page < pageCount ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/blog?pagina=${page + 1}`}>Mais antigos →</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
