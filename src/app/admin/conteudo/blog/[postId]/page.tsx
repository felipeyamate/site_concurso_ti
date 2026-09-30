/**
 * page.tsx — Editar um post do blog: /admin/conteudo/blog/[id]  (PROFESSOR ou mais)
 *
 * Quem chama: a lista de posts (Editar).
 * Mostra o formulário, publicar/despublicar, "ver no site" (o professor vê rascunhos) e apagar.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/admin/action-button";
import { requireRole } from "@/modules/auth/session";
import { deletePostAction, setPostPublishedAction } from "@/modules/blog/actions";
import { getPostForAdmin, listSubjectOptions } from "@/modules/blog/blog-admin.server";
import { PostForm } from "@/modules/blog/components/post-form";

export const metadata: Metadata = {
  title: "Post · Painel admin",
  robots: { index: false },
};

export default async function EditPostPage({ params }: PageProps<"/admin/conteudo/blog/[postId]">) {
  const { postId } = await params;
  await requireRole("TEACHER", `/admin/conteudo/blog/${postId}`);
  const [post, subjects] = await Promise.all([getPostForAdmin(postId), listSubjectOptions()]);
  if (!post) notFound();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <Link href="/admin/conteudo/blog" className="text-muted-foreground text-sm hover:underline">
          ← Blog
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Editar post</h1>
        <p className="text-sm">
          <Link href={`/blog/${post.slug}`} className="underline" target="_blank">
            Ver no site{post.isPublished ? "" : " (prévia do rascunho)"}
          </Link>
        </p>
      </div>
      <PostForm
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          body: post.body,
          subjectId: post.subjectId ?? "",
          isPublished: post.isPublished,
        }}
        subjects={subjects}
      />
      <div className="flex flex-wrap gap-3 border-t pt-4">
        <ActionButton action={setPostPublishedAction} fields={{ postId: post.id, isPublished: post.isPublished ? "false" : "true" }} variant="outline">
          {post.isPublished ? "Despublicar" : "Publicar"}
        </ActionButton>
        <ActionButton action={deletePostAction} fields={{ postId: post.id }} variant="destructive" confirmMessage="Apagar este post? O endereço dele deixa de existir.">
          Apagar post
        </ActionButton>
      </div>
    </div>
  );
}
