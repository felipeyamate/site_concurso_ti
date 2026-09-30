/**
 * tracks-admin.server.ts — Trilhas no painel (PROFESSOR ou mais: é conteúdo): criar/editar, montar
 * pelo "o que mais cai", publicar, apagar, e as etapas e passos (aulas e treinos) em ordem.
 *
 * Quem chama: as ações de `actions.ts` e as páginas /admin/conteudo/trilhas. Os testes chamam direto.
 *
 * Regras:
 *  - Slug único; vazio = gerado do título. Mudou o slug → o endereço antigo redireciona (Fase 6).
 *  - Data de publicação = a da PRIMEIRA publicação.
 *  - Toda mudança na estrutura (etapas e passos) roda com a trava da trilha (`track:<id>`): dois
 *    professores mexendo ao mesmo tempo esperam um ao outro, e as posições nunca se embaralham.
 *  - Uma aula aparece no máximo UMA vez na trilha. Aula, assunto e banca usados numa trilha não se
 *    apagam (o banco recusa — chave estrangeira `Restrict` — e o painel explica).
 *  - A trilha NÃO libera acesso: incluir uma aula aqui não muda quem pode assisti-la.
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { isForeignKeyViolation, isUniqueViolation } from "@/lib/db-errors";
import { withAdvisoryLock } from "@/lib/db-locks";
import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";
import { findAvailableSlug } from "@/modules/catalog/admin/slug";
import { listStudyLessonsBySubject } from "@/modules/catalog/lesson-subjects.server";
import { getBoardIncidence } from "@/modules/questions/incidence.server";
import { recordSlugChange } from "@/modules/seo/redirects.server";

import { buildTrackDraft, type TrackDraftSection } from "./rules";
import type { SectionFormData, TrackFormData, UpdateItemFormData } from "./schemas";

type Tx = Prisma.TransactionClient;
type Direction = "up" | "down";

// Transações com várias gravações: prazo maior que o padrão (5 s), para bancos distantes.
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;

/**
 * Roda `work` com a trava da trilha. Erros "esperados" do banco viram mensagens claras:
 * posição repetida (outra mudança ao mesmo tempo) e chave estrangeira (algo foi apagado no meio).
 */
async function withTrackLock<T>(trackId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await withAdvisoryLock(prisma, `track:${trackId}`, work, TRANSACTION_OPTIONS);
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Outra alteração foi feita nesta trilha ao mesmo tempo. Recarregue a página e tente de novo.");
    if (isForeignKeyViolation(error)) throw new UserFacingError("A aula, o assunto ou a banca escolhidos não existem mais. Recarregue a página.");
    throw error;
  }
}

// =============================================================================================
// Leitura (páginas do painel)
// =============================================================================================

export async function listTracksForAdmin() {
  return prisma.track.findMany({
    orderBy: [{ isPublished: "asc" }, { updatedAt: "desc" }],
    select: { id: true, slug: true, title: true, isPublished: true, board: { select: { name: true } }, _count: { select: { sections: true } } },
  });
}

const named = { select: { id: true, name: true, slug: true } } as const;

export async function getTrackForAdmin(trackId: string) {
  return prisma.track.findUnique({
    where: { id: trackId },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          subject: named,
          items: {
            orderBy: { position: "asc" },
            include: {
              lesson: { select: { id: true, title: true, isPublished: true, course: { select: { title: true, isPublished: true } } } },
              subject: named,
              board: named,
            },
          },
        },
      },
    },
  });
}

/** O que os formulários oferecem: bancas, assuntos, produtos, planos e as aulas de todos os cursos. */
export async function listTrackFormOptions() {
  const [boards, subjects, products, plans, lessons] = await Promise.all([
    prisma.board.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.subject.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.product.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, isActive: true } }),
    prisma.plan.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, isActive: true } }),
    prisma.lesson.findMany({
      orderBy: [{ course: { position: "asc" } }, { course: { title: "asc" } }, { module: { position: "asc" } }, { position: "asc" }],
      select: { id: true, title: true, isPublished: true, course: { select: { title: true } } },
    }),
  ]);
  return { boards, subjects, products, plans, lessons };
}

// =============================================================================================
// Trilha
// =============================================================================================

/**
 * As etapas pelo "o que mais cai" da banca (`buildTrackDraft`): lê a incidência da banca e as aulas
 * de cada assunto (inclusive rascunhos: o professor está montando; o aluno não vê rascunhos).
 */
async function draftFromIncidence(boardId: string): Promise<TrackDraftSection[]> {
  const incidence = await getBoardIncidence(boardId);
  if (!incidence || incidence.subjects.length === 0) {
    throw new UserFacingError("Esta banca ainda não tem questões de prova publicadas: monte as etapas à mão.", { field: "boardId" });
  }
  const subjectIds = incidence.subjects.map((subject) => subject.subjectId);
  const lessonsBySubject = await listStudyLessonsBySubject(subjectIds, { includeDrafts: true, perSubject: 100 });
  return buildTrackDraft({
    incidence: incidence.subjects.map((subject) => ({ subjectId: subject.subjectId, name: subject.name, count: subject.count })),
    lessonIdsBySubject: new Map([...lessonsBySubject].map(([subjectId, lessons]) => [subjectId, lessons.map((lesson) => lesson.id)])),
    boardId,
  });
}

/** Grava o rascunho como etapas e passos (numa trilha SEM etapas). */
async function insertDraft(tx: Tx, trackId: string, draft: TrackDraftSection[]): Promise<void> {
  for (const [index, section] of draft.entries()) {
    const created = await tx.trackSection.create({
      data: { trackId, title: section.title, subjectId: section.subjectId, position: index + 1 },
      select: { id: true },
    });
    await tx.trackItem.createMany({
      data: section.items.map((item, itemIndex) => ({
        sectionId: created.id,
        position: itemIndex + 1,
        ...(item.kind === "LESSON"
          ? { kind: "LESSON" as const, lessonId: item.lessonId }
          : { kind: "PRACTICE" as const, subjectId: item.subjectId, boardId: item.boardId, questionGoal: item.questionGoal }),
      })),
    });
  }
}

/**
 * Cria ou edita uma trilha. Passos: confere banca/produto/plano; gera o slug se vier vazio; grava; na
 * edição, registra o endereço antigo se o slug mudou; ao CRIAR com "montar pelo que mais cai", já grava
 * as etapas (o rascunho é montado antes, fora da transação — é só leitura).
 */
export async function saveTrack(data: TrackFormData, now: Date = new Date()): Promise<{ id: string; slug: string }> {
  let draft: TrackDraftSection[] | null = null;
  if (!data.trackId && data.fromIncidence) {
    if (!data.boardId) throw new UserFacingError("Escolha a banca para montar as etapas pelo que mais cai.", { field: "boardId" });
    draft = await draftFromIncidence(data.boardId);
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const current = data.trackId ? await tx.track.findUnique({ where: { id: data.trackId }, select: { slug: true, publishedAt: true } }) : null;
      if (data.trackId && !current) throw new UserFacingError("Trilha não encontrada.");
      const [board, product, plan] = await Promise.all([
        data.boardId ? tx.board.count({ where: { id: data.boardId } }) : 1,
        data.productId ? tx.product.count({ where: { id: data.productId } }) : 1,
        data.planId ? tx.plan.count({ where: { id: data.planId } }) : 1,
      ]);
      if (board === 0) throw new UserFacingError("Banca não encontrada.", { field: "boardId" });
      if (product === 0) throw new UserFacingError("Produto não encontrado.", { field: "productId" });
      if (plan === 0) throw new UserFacingError("Plano não encontrado.", { field: "planId" });

      const fields = {
        title: data.title,
        summary: data.summary,
        body: data.body,
        boardId: data.boardId,
        productId: data.productId,
        planId: data.planId,
        isPublished: data.isPublished,
      };
      if (data.trackId && current) {
        const slug = data.slug ?? current.slug;
        const track = await tx.track.update({
          where: { id: data.trackId },
          data: { ...fields, slug, publishedAt: current.publishedAt ?? (data.isPublished ? now : null) },
          select: { id: true, slug: true },
        });
        await recordSlugChange(tx, { kind: "TRACK", oldSlug: current.slug, newSlug: slug, targetId: track.id });
        return track;
      }
      const slug =
        data.slug ?? (await findAvailableSlug(data.title, async (candidate) => Boolean(await tx.track.findUnique({ where: { slug: candidate }, select: { id: true } }))));
      const track = await tx.track.create({ data: { ...fields, slug, publishedAt: data.isPublished ? now : null }, select: { id: true, slug: true } });
      if (draft) await insertDraft(tx, track.id, draft);
      return track;
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Já existe uma trilha com este endereço.", { field: "slug" });
    if (isForeignKeyViolation(error)) throw new UserFacingError("Alguma aula ou assunto foi apagado enquanto a trilha era montada. Tente de novo.");
    throw error;
  }
}

/** Numa trilha ainda SEM etapas: monta as etapas pelo "o que mais cai" da banca dela. */
export async function fillTrackFromIncidence(trackId: string): Promise<void> {
  const track = await prisma.track.findUnique({ where: { id: trackId }, select: { boardId: true } });
  if (!track) throw new UserFacingError("Trilha não encontrada.");
  if (!track.boardId) throw new UserFacingError("Escolha a banca da trilha (e salve) antes de montar pelo que mais cai.");
  const draft = await draftFromIncidence(track.boardId);
  await withTrackLock(trackId, async (tx) => {
    if ((await tx.trackSection.count({ where: { trackId } })) > 0) {
      throw new UserFacingError("A trilha já tem etapas. Apague as etapas antes de montar de novo pelo que mais cai.");
    }
    await insertDraft(tx, trackId, draft);
  });
}

export async function setTrackPublished(trackId: string, isPublished: boolean, now: Date = new Date()): Promise<void> {
  const track = await prisma.track.findUnique({ where: { id: trackId }, select: { publishedAt: true } });
  if (!track) throw new UserFacingError("Trilha não encontrada.");
  await prisma.track.update({ where: { id: trackId }, data: { isPublished, publishedAt: track.publishedAt ?? (isPublished ? now : null) } });
}

/** Apaga a trilha (etapas e passos vão junto; páginas de concurso que a indicavam ficam sem trilha). */
export async function deleteTrack(trackId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.track.deleteMany({ where: { id: trackId } });
    if (count === 0) throw new UserFacingError("Trilha não encontrada.");
    await tx.slugRedirect.deleteMany({ where: { kind: "TRACK", targetId: trackId } });
  });
}

// =============================================================================================
// Etapas
// =============================================================================================

// Posições são ÚNICAS (dentro da trilha / da etapa): para trocar duas de lugar usamos uma posição
// temporária (-1) — como trocar dois copos de lugar usando um terceiro. Ao apagar, as seguintes
// sobem uma posição, do menor para o maior (nunca há duas iguais no meio do caminho).
type Positioned = { id: string; position: number };

async function swapSections(tx: Tx, a: Positioned, b: Positioned) {
  await tx.trackSection.update({ where: { id: a.id }, data: { position: -1 } });
  await tx.trackSection.update({ where: { id: b.id }, data: { position: a.position } });
  await tx.trackSection.update({ where: { id: a.id }, data: { position: b.position } });
}

async function closeSectionGap(tx: Tx, trackId: string, removed: number) {
  const after = await tx.trackSection.findMany({ where: { trackId, position: { gt: removed } }, orderBy: { position: "asc" }, select: { id: true, position: true } });
  for (const section of after) await tx.trackSection.update({ where: { id: section.id }, data: { position: section.position - 1 } });
}

async function trackIdOfSection(sectionId: string): Promise<string> {
  const section = await prisma.trackSection.findUnique({ where: { id: sectionId }, select: { trackId: true } });
  if (!section) throw new UserFacingError("Etapa não encontrada.");
  return section.trackId;
}

/** Cria (no fim da trilha) ou edita uma etapa. */
export async function saveSection(data: SectionFormData): Promise<{ id: string }> {
  return withTrackLock(data.trackId, async (tx) => {
    if ((await tx.track.count({ where: { id: data.trackId } })) === 0) throw new UserFacingError("Trilha não encontrada.");
    if (data.subjectId && (await tx.subject.count({ where: { id: data.subjectId } })) === 0) {
      throw new UserFacingError("Assunto não encontrado.", { field: "subjectId" });
    }
    const fields = { title: data.title, description: data.description, subjectId: data.subjectId };
    if (data.sectionId) {
      const { count } = await tx.trackSection.updateMany({ where: { id: data.sectionId, trackId: data.trackId }, data: fields });
      if (count === 0) throw new UserFacingError("Etapa não encontrada.");
      return { id: data.sectionId };
    }
    const last = await tx.trackSection.aggregate({ where: { trackId: data.trackId }, _max: { position: true } });
    return tx.trackSection.create({ data: { ...fields, trackId: data.trackId, position: (last._max.position ?? 0) + 1 }, select: { id: true } });
  });
}

export async function moveSection(sectionId: string, direction: Direction): Promise<void> {
  const trackId = await trackIdOfSection(sectionId);
  await withTrackLock(trackId, async (tx) => {
    const current = await tx.trackSection.findUnique({ where: { id: sectionId }, select: { id: true, position: true } });
    if (!current) throw new UserFacingError("Etapa não encontrada.");
    const neighbor = await tx.trackSection.findFirst({
      where: { trackId, position: direction === "up" ? { lt: current.position } : { gt: current.position } },
      orderBy: { position: direction === "up" ? "desc" : "asc" },
      select: { id: true, position: true },
    });
    if (neighbor) await swapSections(tx, current, neighbor);
  });
}

/** Apaga a etapa com os passos dela. */
export async function deleteSection(sectionId: string): Promise<void> {
  const trackId = await trackIdOfSection(sectionId);
  await withTrackLock(trackId, async (tx) => {
    const section = await tx.trackSection.findUnique({ where: { id: sectionId }, select: { position: true } });
    if (!section) throw new UserFacingError("Etapa não encontrada.");
    await tx.trackSection.delete({ where: { id: sectionId } });
    await closeSectionGap(tx, trackId, section.position);
  });
}

// =============================================================================================
// Passos (aulas e treinos)
// =============================================================================================

async function swapItems(tx: Tx, a: Positioned, b: Positioned) {
  await tx.trackItem.update({ where: { id: a.id }, data: { position: -1 } });
  await tx.trackItem.update({ where: { id: b.id }, data: { position: a.position } });
  await tx.trackItem.update({ where: { id: a.id }, data: { position: b.position } });
}

async function closeItemGap(tx: Tx, sectionId: string, removed: number) {
  const after = await tx.trackItem.findMany({ where: { sectionId, position: { gt: removed } }, orderBy: { position: "asc" }, select: { id: true, position: true } });
  for (const item of after) await tx.trackItem.update({ where: { id: item.id }, data: { position: item.position - 1 } });
}

async function nextItemPosition(tx: Tx, sectionId: string): Promise<number> {
  const last = await tx.trackItem.aggregate({ where: { sectionId }, _max: { position: true } });
  return (last._max.position ?? 0) + 1;
}

async function trackIdOfItem(itemId: string): Promise<string> {
  const item = await prisma.trackItem.findUnique({ where: { id: itemId }, select: { section: { select: { trackId: true } } } });
  if (!item) throw new UserFacingError("Passo não encontrado.");
  return item.section.trackId;
}

/** Confere (dentro da trava) que a etapa é desta trilha. */
async function ensureSectionOfTrack(tx: Tx, sectionId: string, trackId: string): Promise<void> {
  if ((await tx.trackSection.count({ where: { id: sectionId, trackId } })) === 0) throw new UserFacingError("Etapa não encontrada.");
}

/** Inclui uma aula no fim da etapa. Uma aula entra no máximo uma vez na trilha. */
export async function addLessonItem(input: { sectionId: string; lessonId: string; note: string }): Promise<void> {
  const trackId = await trackIdOfSection(input.sectionId);
  await withTrackLock(trackId, async (tx) => {
    await ensureSectionOfTrack(tx, input.sectionId, trackId);
    if ((await tx.lesson.count({ where: { id: input.lessonId } })) === 0) throw new UserFacingError("Aula não encontrada.", { field: "lessonId" });
    const repeated = await tx.trackItem.findFirst({ where: { lessonId: input.lessonId, section: { trackId } }, select: { section: { select: { title: true } } } });
    if (repeated) throw new UserFacingError(`Esta aula já está na trilha (etapa "${repeated.section.title}").`, { field: "lessonId" });
    await tx.trackItem.create({
      data: { sectionId: input.sectionId, position: await nextItemPosition(tx, input.sectionId), kind: "LESSON", lessonId: input.lessonId, note: input.note },
    });
  });
}

/** Inclui um treino de questões (assunto, banca opcional e meta) no fim da etapa. */
export async function addPracticeItem(input: { sectionId: string; subjectId: string; boardId: string | null; questionGoal: number; note: string }): Promise<void> {
  const trackId = await trackIdOfSection(input.sectionId);
  await withTrackLock(trackId, async (tx) => {
    await ensureSectionOfTrack(tx, input.sectionId, trackId);
    if ((await tx.subject.count({ where: { id: input.subjectId } })) === 0) throw new UserFacingError("Assunto não encontrado.", { field: "subjectId" });
    if (input.boardId && (await tx.board.count({ where: { id: input.boardId } })) === 0) throw new UserFacingError("Banca não encontrada.", { field: "boardId" });
    await tx.trackItem.create({
      data: {
        sectionId: input.sectionId,
        position: await nextItemPosition(tx, input.sectionId),
        kind: "PRACTICE",
        subjectId: input.subjectId,
        boardId: input.boardId,
        questionGoal: input.questionGoal,
        note: input.note,
      },
    });
  });
}

/**
 * Edita um passo: a dica; no treino, a banca e a meta; e muda de etapa (vai para o fim da nova etapa,
 * e as seguintes da etapa antiga sobem uma posição).
 */
export async function updateItem(data: UpdateItemFormData): Promise<void> {
  const trackId = await trackIdOfItem(data.itemId);
  await withTrackLock(trackId, async (tx) => {
    const item = await tx.trackItem.findUnique({ where: { id: data.itemId }, select: { kind: true, sectionId: true, position: true } });
    if (!item) throw new UserFacingError("Passo não encontrado.");
    await ensureSectionOfTrack(tx, data.sectionId, trackId);
    let practiceFields = {};
    if (item.kind === "PRACTICE") {
      if (data.questionGoal === undefined) throw new UserFacingError("Digite a meta de questões.", { field: "questionGoal" });
      if (data.boardId && (await tx.board.count({ where: { id: data.boardId } })) === 0) throw new UserFacingError("Banca não encontrada.", { field: "boardId" });
      practiceFields = { boardId: data.boardId, questionGoal: data.questionGoal };
    }
    const moving = data.sectionId !== item.sectionId;
    await tx.trackItem.update({
      where: { id: data.itemId },
      data: {
        note: data.note,
        ...practiceFields,
        ...(moving ? { sectionId: data.sectionId, position: await nextItemPosition(tx, data.sectionId) } : {}),
      },
    });
    if (moving) await closeItemGap(tx, item.sectionId, item.position);
  });
}

export async function moveItem(itemId: string, direction: Direction): Promise<void> {
  const trackId = await trackIdOfItem(itemId);
  await withTrackLock(trackId, async (tx) => {
    const current = await tx.trackItem.findUnique({ where: { id: itemId }, select: { id: true, position: true, sectionId: true } });
    if (!current) throw new UserFacingError("Passo não encontrado.");
    const neighbor = await tx.trackItem.findFirst({
      where: { sectionId: current.sectionId, position: direction === "up" ? { lt: current.position } : { gt: current.position } },
      orderBy: { position: direction === "up" ? "desc" : "asc" },
      select: { id: true, position: true },
    });
    if (neighbor) await swapItems(tx, current, neighbor);
  });
}

export async function deleteItem(itemId: string): Promise<void> {
  const trackId = await trackIdOfItem(itemId);
  await withTrackLock(trackId, async (tx) => {
    const item = await tx.trackItem.findUnique({ where: { id: itemId }, select: { sectionId: true, position: true } });
    if (!item) throw new UserFacingError("Passo não encontrado.");
    await tx.trackItem.delete({ where: { id: itemId } });
    await closeItemGap(tx, item.sectionId, item.position);
  });
}
