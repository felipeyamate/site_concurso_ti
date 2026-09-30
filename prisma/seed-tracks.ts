/**
 * seed-tracks.ts — Conteúdo de EXEMPLO da Fase 8: os assuntos das aulas do Curso Base e uma trilha
 * FICTÍCIA montada pelo "o que mais cai" da Cesgranrio (das provas fictícias do seed).
 *
 * Quem chama: `seed.ts` (`npm run db:seed`), depois do catálogo, do banco de questões e do marketing.
 * Pode rodar várias vezes: a ligação aula ↔ assunto é "cria se não existe" e a trilha só é criada se
 * ainda não existir (depois disso, quem manda nela é o painel).
 * Também liga a página de concurso fictícia (`exemplo-banco-escriturario-2026`) a esta trilha.
 */
import type { PrismaClient } from "../src/generated/prisma/client";
import { buildTrackDraft } from "../src/modules/tracks/rules";

const BASE_COURSE = "informatica-e-ti-do-zero";

// Aula do Curso Base → assuntos (slugs do `seed-questions.ts`) que ela ensina.
const LESSON_SUBJECTS: Record<string, string[]> = {
  "computador-por-dentro": ["hardware"],
  "tipos-de-software-e-licencas": ["hardware"],
  "pastas-arquivos-e-extensoes": ["sistemas-operacionais"],
  "atalhos-de-teclado-que-mais-caem": ["sistemas-operacionais", "office-e-libreoffice"],
  "word-e-writer-o-essencial": ["office-e-libreoffice"],
  "excel-e-calc-funcoes-que-mais-caem": ["office-e-libreoffice"],
  "navegadores-historico-cookies": ["redes-e-internet"],
  "email-cc-cco-e-protocolos": ["redes-e-internet"],
  "pilares-da-seguranca": ["seguranca-da-informacao"],
  "malwares-virus-worm-trojan-ransomware": ["seguranca-da-informacao"],
  "golpes-phishing-engenharia-social": ["seguranca-da-informacao"],
  "backup-completo-incremental-diferencial": ["seguranca-da-informacao"],
  "redes-em-linguagem-simples": ["redes-e-internet"],
  "computacao-em-nuvem-iaas-paas-saas": ["computacao-em-nuvem"],
};

export const SEED_TRACK_SLUG = "exemplo-trilha-cesgranrio-banco";

export async function seedTracks(prisma: PrismaClient, now: Date = new Date()): Promise<{ lessonSubjects: number; tracks: number }> {
  // 1. Assuntos das aulas (só cria o que falta; o professor pode mudar pelo painel).
  const subjects = await prisma.subject.findMany({ select: { id: true, slug: true, name: true } });
  const subjectBySlug = new Map(subjects.map((subject) => [subject.slug, subject]));
  const lessons = await prisma.lesson.findMany({ where: { course: { slug: BASE_COURSE } }, select: { id: true, slug: true } });
  const links = lessons.flatMap((lesson) =>
    (LESSON_SUBJECTS[lesson.slug] ?? []).flatMap((slug) => {
      const subject = subjectBySlug.get(slug);
      return subject ? [{ lessonId: lesson.id, subjectId: subject.id }] : [];
    }),
  );
  const { count: lessonSubjects } = await prisma.lessonSubject.createMany({ data: links, skipDuplicates: true });

  // 2. A trilha fictícia, montada pelo "o que mais cai" da Cesgranrio (mesma regra do painel).
  let tracks = 0;
  const board = await prisma.board.findUnique({ where: { slug: "cesgranrio" }, select: { id: true } });
  let track = await prisma.track.findUnique({ where: { slug: SEED_TRACK_SLUG }, select: { id: true } });
  if (!track && board) {
    const counts = await prisma.question.groupBy({
      by: ["subjectId"],
      where: { isPublished: true, examId: { not: null }, boardId: board.id },
      _count: { _all: true },
    });
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const lessonRows = await prisma.lessonSubject.findMany({
      where: { lesson: { course: { slug: BASE_COURSE } } },
      select: { subjectId: true, lesson: { select: { id: true, position: true, module: { select: { position: true } } } } },
    });
    lessonRows.sort((a, b) => a.lesson.module.position - b.lesson.module.position || a.lesson.position - b.lesson.position);
    const lessonIdsBySubject = new Map<string, string[]>();
    for (const row of lessonRows) lessonIdsBySubject.set(row.subjectId, [...(lessonIdsBySubject.get(row.subjectId) ?? []), row.lesson.id]);

    const draft = buildTrackDraft({
      incidence: counts.map((row) => ({ subjectId: row.subjectId, name: subjectById.get(row.subjectId)?.name ?? "Assunto", count: row._count._all })),
      lessonIdsBySubject,
      boardId: board.id,
    });
    const product = await prisma.product.findFirst({ where: { isActive: true, courses: { some: { course: { slug: BASE_COURSE } } } }, select: { id: true } });
    const plan = await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { priceCents: "asc" }, select: { id: true } });
    track = await prisma.track.create({
      data: {
        slug: SEED_TRACK_SLUG,
        title: "Exemplo — Trilha Cesgranrio (Banco)",
        summary: "Trilha de EXEMPLO (fictícia): as aulas do Curso Base e treinos de questões na ordem do que mais cai nas provas de exemplo da Cesgranrio.",
        body: `Esta é uma trilha **fictícia**, criada pelo conteúdo de exemplo do site.

## Como usar

- Siga as etapas **em ordem**: elas começam pelo assunto que mais cai na banca.
- Em cada etapa, assista às aulas e depois faça o **treino de questões** até a meta.
- Errou uma questão? A tela mostra a aula que ensina o assunto.`,
        boardId: board.id,
        productId: product?.id ?? null,
        planId: plan?.id ?? null,
        isPublished: true,
        publishedAt: now,
        sections: {
          create: draft.map((section, index) => ({
            title: section.title,
            subjectId: section.subjectId,
            position: index + 1,
            items: {
              create: section.items.map((item, itemIndex) =>
                item.kind === "LESSON"
                  ? { kind: "LESSON" as const, lessonId: item.lessonId, position: itemIndex + 1 }
                  : { kind: "PRACTICE" as const, subjectId: item.subjectId, boardId: item.boardId, questionGoal: item.questionGoal, position: itemIndex + 1 },
              ),
            },
          })),
        },
      },
      select: { id: true },
    });
    tracks += 1;
  }

  // 3. A página de concurso fictícia indica a trilha (se ainda não indica nenhuma).
  if (track) {
    await prisma.examNotice.updateMany({ where: { slug: "exemplo-banco-escriturario-2026", trackId: null }, data: { trackId: track.id } });
  }
  return { lessonSubjects, tracks };
}
