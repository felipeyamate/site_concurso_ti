/**
 * post-card.tsx — Cartão de um post nas listas (blog, página inicial, "leia também").
 *
 * Quem chama: /blog, a página inicial e o fim de cada post.
 */
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

import type { PostCard as PostCardData } from "../blog.server";

export function PostCard({ post }: { post: PostCardData }) {
  return (
    <article className="grid gap-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {post.publishedAt ? <span className="text-muted-foreground">{formatDate(post.publishedAt)}</span> : null}
        {post.subject ? <Badge variant="secondary">{post.subject.name}</Badge> : null}
      </div>
      <h2 className="text-lg leading-snug font-semibold">
        <Link href={`/blog/${post.slug}`} className="hover:underline">
          {post.title}
        </Link>
      </h2>
      <p className="text-muted-foreground text-sm leading-relaxed">{post.summary}</p>
    </article>
  );
}
