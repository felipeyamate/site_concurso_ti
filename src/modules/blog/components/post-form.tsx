"use client";

/**
 * post-form.tsx — Formulário de post do blog no painel (criar e editar).
 *
 * Quem chama: /admin/conteudo/blog/novo e /admin/conteudo/blog/[id].
 * As regras (slug único, data da 1ª publicação, endereço antigo redirecionando) ficam no servidor.
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { MarkdownField } from "@/components/admin/markdown-field";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { savePostAction } from "../actions";

export type PostFormValues = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  subjectId: string;
  isPublished: boolean;
};

export function PostForm({ post, subjects }: { post: PostFormValues; subjects: Array<{ id: string; name: string }> }) {
  const { state, onSubmit, pending } = useAdminForm(savePostAction);
  const errors = state.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {post.id ? <input type="hidden" name="postId" value={post.id} /> : null}
      <div className="grid gap-2">
        <Label htmlFor="post-title">Título</Label>
        <Input id="post-title" name="title" defaultValue={post.title} required aria-invalid={errors.title ? true : undefined} />
        <FieldError id="post-title-error" message={errors.title} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="post-slug">Endereço (slug)</Label>
          <Input id="post-slug" name="slug" defaultValue={post.slug} placeholder="vazio = gerado do título" aria-invalid={errors.slug ? true : undefined} />
          <p className="text-muted-foreground text-xs">
            /blog/<strong>{post.slug || "…"}</strong>. Mudando depois, o endereço antigo continua levando ao post.
          </p>
          <FieldError id="post-slug-error" message={errors.slug} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="post-subject">Assunto (atalho para treinar questões no fim do post)</Label>
          <NativeSelect id="post-subject" name="subjectId" defaultValue={post.subjectId}>
            <option value="">Nenhum</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </NativeSelect>
          <FieldError id="post-subject-error" message={errors.subjectId} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="post-excerpt">Resumo (lista do blog e Google; vazio = começo do texto)</Label>
        <Textarea id="post-excerpt" name="excerpt" defaultValue={post.excerpt} rows={2} maxLength={300} aria-invalid={errors.excerpt ? true : undefined} />
        <FieldError id="post-excerpt-error" message={errors.excerpt} />
      </div>
      <MarkdownField id="post-body" name="body" label="Texto" defaultValue={post.body} error={errors.body} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={post.isPublished} className="accent-primary size-4" />
        Publicado (aparece no blog, no RSS e no Google)
      </label>
      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : post.id ? "Salvar post" : "Criar post"}
        </Button>
      </div>
    </form>
  );
}
