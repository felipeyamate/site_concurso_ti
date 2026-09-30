/**
 * schemas.test.ts — Formulário de post: slug opcional (gerado pelo servidor) e limites.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { blogPostSchema } from "./schemas";

const base = { title: "O que é phishing", slug: "", excerpt: "", body: "Texto do post com pelo menos cinquenta caracteres, ok.", subjectId: "", isPublished: "on" };

describe("blogPostSchema", () => {
  it("slug vazio fica null (o servidor gera); publicado vira booleano", () => {
    expect(blogPostSchema.parse(base)).toMatchObject({ slug: null, subjectId: null, isPublished: true, postId: null });
  });

  it("recusa slug inválido e texto curto", () => {
    expect(blogPostSchema.safeParse({ ...base, slug: "Com Espaço" }).success).toBe(false);
    expect(blogPostSchema.safeParse({ ...base, body: "curto" }).success).toBe(false);
  });
});
