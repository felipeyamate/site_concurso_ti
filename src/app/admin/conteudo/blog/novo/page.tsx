/**
 * page.tsx — Novo post do blog: /admin/conteudo/blog/novo  (PROFESSOR ou mais)
 *
 * Quem chama: o botão "Novo post". Depois de criar, vai para a página de edição do post.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/modules/auth/session";
import { listSubjectOptions } from "@/modules/blog/blog-admin.server";
import { PostForm } from "@/modules/blog/components/post-form";

export const metadata: Metadata = {
  title: "Novo post · Painel admin",
  robots: { index: false },
};

export default async function NewPostPage() {
  await requireRole("TEACHER", "/admin/conteudo/blog/novo");
  const subjects = await listSubjectOptions();
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <Link href="/admin/conteudo/blog" className="text-muted-foreground text-sm hover:underline">
          ← Blog
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Novo post</h1>
      </div>
      <PostForm post={{ id: null, title: "", slug: "", excerpt: "", body: "", subjectId: "", isPublished: false }} subjects={subjects} />
    </div>
  );
}
