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

export const metadata: Metadata = {
  title: "Blog: Informática e TI para concursos, sem complicação",
  description: "Artigos em linguagem simples sobre os assuntos de TI que mais caem em concursos: segurança, redes, Office, sistemas operacionais e mais.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": [{ url: "/blog/rss.xml", title: `Blog ${SITE_NAME}` }] } },
};

export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  await connection();
  const pageParam = (await searchParams).pagina;
  const requested = Number(typeof pageParam === "string" ? pageParam : "1");
  const { posts, page, pageCount } = await listPublishedPosts(Number.isInteger(requested) ? requested : 1);

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
