/**
 * page.tsx — Posts do blog no painel: /admin/conteudo/blog  (PROFESSOR ou mais)
 *
 * Quem chama: o Next.js (Conteúdo do site → Blog).
 * Lista os posts (rascunhos primeiro) com o link para editar e o botão "Novo post".
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { requireRole } from "@/modules/auth/session";
import { listPostsForAdmin } from "@/modules/blog/blog-admin.server";

export const metadata: Metadata = {
  title: "Blog · Painel admin",
  robots: { index: false },
};

export default async function AdminBlogPage() {
  await requireRole("TEACHER", "/admin/conteudo/blog");
  const posts = await listPostsForAdmin();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
          <p className="text-muted-foreground text-sm">Artigos em linguagem simples atraem alunos pelo Google. Publicados aparecem em /blog e no RSS.</p>
        </div>
        <Button asChild>
          <Link href="/admin/conteudo/blog/novo">Novo post</Link>
        </Button>
      </div>

      {posts.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum post ainda.</p>
      ) : (
        <div className="grid gap-3">
          {posts.map((post) => (
            <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{post.title}</span>
                  <Badge variant={post.isPublished ? "default" : "secondary"}>{post.isPublished ? "Publicado" : "Rascunho"}</Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  /blog/{post.slug}
                  {post.publishedAt ? ` · publicado em ${formatDate(post.publishedAt)}` : ""} · editado em {formatDate(post.updatedAt)}
                  {post.author ? ` · ${post.author.name}` : ""}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/conteudo/blog/${post.id}`}>Editar</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
