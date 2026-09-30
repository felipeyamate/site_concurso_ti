/**
 * content.test.ts — Testes de integração da Fase 6: blog, páginas de edital, endereços antigos
 * (redirecionamento), sitemap, RSS e o conteúdo de exemplo — com PostgreSQL de verdade.
 *
 * Rodar: npm run test:integration   (exige TEST_DATABASE_URL — ver README)
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { deletePost, savePost, setPostPublished } from "@/modules/blog/blog-admin.server";
import { getPostForViewer, listPublishedPosts, listRelatedPosts } from "@/modules/blog/blog.server";
import { blogPostSchema } from "@/modules/blog/schemas";
import { createCourse, createLesson, createModule, updateCourse, updateLesson } from "@/modules/catalog/admin/catalog-admin.server";
import { saveNotice } from "@/modules/notices/notices-admin.server";
import { getNoticeForViewer, listPublishedNotices } from "@/modules/notices/notices.server";
import { noticeSchema } from "@/modules/notices/schemas";
import { buildBlogRssXml, buildSitemapEntries } from "@/modules/seo/feeds.server";
import { currentCatalogPath, findRedirectTarget } from "@/modules/seo/redirects.server";
import { seedMarketing } from "../../prisma/seed-marketing";
import { seedQuestionBank } from "../../prisma/seed-questions";

const T0 = new Date("2026-10-01T15:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const BODY = "Texto do post com pelo menos cinquenta caracteres para passar na validação.";

async function resetContent() {
  await prisma.slugRedirect.deleteMany();
  await prisma.blogPost.deleteMany();
  await prisma.examNoticeSubject.deleteMany();
  await prisma.examNotice.deleteMany();
  await prisma.coupon.deleteMany({ where: { code: { startsWith: "CT-" } } });
  await prisma.course.deleteMany({ where: { slug: { startsWith: "teste-conteudo" } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: "ct-" } } });
}

const post = (input: Record<string, unknown>) => blogPostSchema.parse({ title: "Título do post", slug: "", excerpt: "", body: BODY, subjectId: "", ...input });

let authorId: string;

beforeEach(async () => {
  await resetContent();
  authorId = (await prisma.user.create({ data: { id: "ct-prof", name: "Professora", email: "ct-prof@exemplo.com", role: "TEACHER" } })).id;
});

afterAll(async () => {
  await resetContent();
});

describe("blog", () => {
  it("slug gerado do título; data de publicação é a da 1ª vez; rascunho só para quem pode ver", async () => {
    const draft = await savePost(post({ title: "O que é phishing?" }), authorId, T0);
    expect(draft.slug).toBe("o-que-e-phishing");
    expect(await getPostForViewer(draft.slug, false)).toBeNull();
    expect(await getPostForViewer(draft.slug, true)).toMatchObject({ isPublished: false });

    await setPostPublished(draft.id, true, new Date(T0.getTime() + DAY));
    await setPostPublished(draft.id, false, new Date(T0.getTime() + 2 * DAY));
    await setPostPublished(draft.id, true, new Date(T0.getTime() + 3 * DAY));
    expect((await prisma.blogPost.findUniqueOrThrow({ where: { id: draft.id } })).publishedAt?.toISOString()).toBe(new Date(T0.getTime() + DAY).toISOString());

    // Mesmo título: o segundo ganha um sufixo; slug repetido digitado dá erro no campo.
    expect((await savePost(post({ title: "O que é phishing?" }), authorId, T0)).slug).toBe("o-que-e-phishing-2");
    await expect(savePost(post({ slug: "o-que-e-phishing" }), authorId, T0)).rejects.toThrow(/Já existe um post/);
  });

  it("trocar o slug: o endereço antigo leva ao post (e apagar o post limpa os redirecionamentos)", async () => {
    const created = await savePost(post({ slug: "slug-antigo", isPublished: "on" }), authorId, T0);
    await savePost(post({ postId: created.id, slug: "slug-novo", isPublished: "on" }), authorId, T0);
    expect(await findRedirectTarget("BLOG_POST", "slug-antigo")).toBe(created.id);
    // Voltar ao slug antigo: ele deixa de ser "antigo" (e o intermediário passa a redirecionar).
    await savePost(post({ postId: created.id, slug: "slug-antigo", isPublished: "on" }), authorId, T0);
    expect(await findRedirectTarget("BLOG_POST", "slug-antigo")).toBeNull();
    expect(await findRedirectTarget("BLOG_POST", "slug-novo")).toBe(created.id);
    await deletePost(created.id);
    expect(await prisma.slugRedirect.count()).toBe(0);
  });

  it("lista publicada (mais novos primeiro), relacionados do mesmo assunto e RSS só com publicados", async () => {
    const subject = await prisma.subject.upsert({ where: { slug: "ct-seguranca" }, create: { slug: "ct-seguranca", name: "CT Segurança" }, update: {} });
    const a = await savePost(post({ title: "Post A", isPublished: "on", subjectId: subject.id }), authorId, T0);
    await savePost(post({ title: "Post B", isPublished: "on" }), authorId, new Date(T0.getTime() + DAY));
    const c = await savePost(post({ title: "Post C & <especial>", isPublished: "on", subjectId: subject.id }), authorId, new Date(T0.getTime() + 2 * DAY));
    await savePost(post({ title: "Rascunho" }), authorId, T0);

    const list = await listPublishedPosts(1);
    expect(list.posts.map((item) => item.title)).toEqual(["Post C & <especial>", "Post B", "Post A"]);
    expect(list.posts[0].summary).toContain("Texto do post");
    expect((await listRelatedPosts({ id: a.id, subjectId: subject.id })).map((item) => item.id)[0]).toBe(c.id);

    const xml = await buildBlogRssXml();
    expect(xml.match(/<item>/g)).toHaveLength(3);
    expect(xml).toContain("Post C &amp; &lt;especial&gt;");
    expect(xml).not.toContain("Rascunho");
    await prisma.subject.delete({ where: { id: subject.id } });
  });
});

describe("páginas de edital", () => {
  const notice = (input: Record<string, unknown>) =>
    noticeSchema.parse({ title: "Concurso de teste 2026", slug: "", organization: "Órgão", role: "", boardId: "", status: "OPEN", vacancies: "", salary: "", summary: "", body: "", ...input });

  it("cupom precisa existir; oferta inativa não aparece; 'o que mais cai' da banca", async () => {
    await seedQuestionBank(prisma);
    const board = await prisma.board.findUniqueOrThrow({ where: { slug: "cesgranrio" } });
    await expect(saveNotice(notice({ couponCode: "CT-NAO-EXISTE" }), T0)).rejects.toThrow(/Não existe cupom/);

    const product = await prisma.product.create({ data: { slug: "ct-produto", title: "Produto", priceCents: 9900, isActive: false } });
    const created = await saveNotice(notice({ boardId: board.id, productId: product.id, isPublished: "on" }), T0);
    const view = await getNoticeForViewer(created.slug, false);
    expect(view?.product).toBeNull(); // produto inativo: sem botão de compra
    expect(view?.topSubjects[0]).toMatchObject({ name: "Segurança da Informação" });
    await prisma.examNotice.delete({ where: { id: created.id } });
    await prisma.product.delete({ where: { id: product.id } });
  });

  it("rascunho escondido; lista com inscrições abertas primeiro; slug antigo redireciona", async () => {
    const done = await saveNotice(notice({ title: "Concurso antigo", status: "DONE", isPublished: "on" }), T0);
    const open = await saveNotice(notice({ title: "Concurso aberto", status: "OPEN", isPublished: "on" }), T0);
    const draft = await saveNotice(notice({ title: "Concurso rascunho" }), T0);
    expect(await getNoticeForViewer(draft.slug, false)).toBeNull();
    expect((await listPublishedNotices()).map((item) => item.id)).toEqual([open.id, done.id]);

    await saveNotice(notice({ noticeId: open.id, title: "Concurso aberto", slug: "concurso-aberto-2026", status: "OPEN", isPublished: "on" }), T0);
    expect(await findRedirectTarget("EXAM_NOTICE", open.slug)).toBe(open.id);
  });
});

describe("endereços antigos do catálogo", () => {
  it("curso e aula mudam de slug (até duas vezes): o endereço mais antigo leva direto ao atual", async () => {
    const course = await createCourse({ title: "teste-conteudo curso" });
    const courseModule = await createModule({ courseId: course.id, title: "Módulo" });
    const lesson = await createLesson({ moduleId: courseModule.id, title: "Aula um" });
    const edit = { title: "Curso", subtitle: null, description: "", isPublished: true };
    await updateCourse({ courseId: course.id, slug: "teste-conteudo-b", ...edit });
    await updateCourse({ courseId: course.id, slug: "teste-conteudo-c", ...edit });
    const lessonEdit = { lessonId: lesson.id, moduleId: courseModule.id, title: "Aula", description: "", isFreePreview: false, isPublished: true };
    await updateLesson({ ...lessonEdit, slug: "aula-nova" });

    expect(await currentCatalogPath(course.slug)).toBe("/cursos/teste-conteudo-c");
    expect(await currentCatalogPath("teste-conteudo-b")).toBe("/cursos/teste-conteudo-c");
    expect(await currentCatalogPath(course.slug, lesson.slug)).toBe("/cursos/teste-conteudo-c/aulas/aula-nova");
    expect(await currentCatalogPath("teste-conteudo-c", "nao-existe")).toBeNull();
    expect(await currentCatalogPath("nao-existe")).toBeNull();
  });
});

describe("sitemap e conteúdo de exemplo", () => {
  it("o seed de marketing cria uma vez só; o sitemap tem os publicados e não os rascunhos", async () => {
    await seedQuestionBank(prisma);
    expect(await seedMarketing(prisma, T0)).toEqual({ posts: 3, notices: 1 });
    expect(await seedMarketing(prisma, T0)).toEqual({ posts: 0, notices: 0 });
    await savePost(post({ title: "Post rascunho do sitemap" }), authorId, T0);

    const urls = (await buildSitemapEntries()).map((entry) => entry.url);
    expect(urls).toContain("http://localhost:3000/blog/o-que-e-phishing-e-por-que-cai-tanto");
    expect(urls).toContain("http://localhost:3000/concursos/exemplo-banco-escriturario-2026");
    expect(urls.some((url) => url.includes("post-rascunho-do-sitemap"))).toBe(false);
    expect(urls.some((url) => url.includes("/admin") || url.includes("/area-do-aluno"))).toBe(false);
  });
});
