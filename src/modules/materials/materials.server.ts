/**
 * materials.server.ts — Materiais das aulas (PDFs): enviar, listar, apagar e baixar.
 *
 * Quem chama:
 *  - as Server Actions do painel (`actions.ts`), que já conferiram que é professor/admin;
 *  - a página da aula (lista dos materiais, quando o aluno tem acesso);
 *  - a rota de download `/cursos/<curso>/aulas/<aula>/materiais/<id>`.
 *
 * Envio em 3 passos (o arquivo vai do navegador DIRETO para o armazenamento):
 *  1. `prepareAttachmentUpload`: valida o arquivo e devolve um link de envio temporário (10 min).
 *  2. O navegador envia o PDF para esse link.
 *  3. `confirmAttachmentUpload`: confere que o arquivo chegou (e o tamanho) e só então grava no banco.
 *
 * Download: `getAttachmentDownloadUrl` confere o ACESSO À AULA com a mesma regra do vídeo
 * (`checkLessonAccess`, via `getLessonAccessForUser`) e só então gera um link que vale 5 minutos.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import { isRecordNotFound, isUniqueViolation } from "@/lib/db-errors";
import { UserFacingError } from "@/lib/form-state";
import { getLessonAccessForUser } from "@/modules/enrollment/enrollment.server";
import {
  PDF_CONTENT_TYPE,
  buildAttachmentKey,
  isAttachmentKeyOfLesson,
  sanitizeFileName,
  titleFromFileName,
} from "@/modules/storage/files";
import type { FileStorage, UploadTarget } from "@/modules/storage/types";

import { MAX_PDF_BYTES, validatePdfUpload } from "./rules";

const UPLOAD_LINK_SECONDS = 10 * 60;
const DOWNLOAD_LINK_SECONDS = 5 * 60;
const MAX_TITLE_LENGTH = 150;

/** Materiais de uma aula, na ordem em que foram enviados. */
export async function listLessonAttachments(lessonId: string) {
  return prisma.lessonAttachment.findMany({
    where: { lessonId },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, fileName: true, sizeBytes: true },
  });
}

/** Passo 1 do envio: valida e devolve o link temporário para o navegador enviar o PDF. */
export async function prepareAttachmentUpload(params: {
  storage: FileStorage;
  lessonId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}): Promise<{ key: string; target: UploadTarget }> {
  const problem = validatePdfUpload(params);
  if (problem) throw new UserFacingError(problem);

  const lesson = await prisma.lesson.findUnique({ where: { id: params.lessonId }, select: { id: true } });
  if (!lesson) throw new UserFacingError("Aula não encontrada.");

  const key = buildAttachmentKey(lesson.id, randomUUID());
  const target = await params.storage.createUploadTarget({
    key,
    contentType: PDF_CONTENT_TYPE,
    maxBytes: MAX_PDF_BYTES,
    expiresInSeconds: UPLOAD_LINK_SECONDS,
  });
  return { key, target };
}

/**
 * Passo 3 do envio: confere o arquivo no armazenamento e registra o material no banco.
 * Se o arquivo que chegou não serve (grande demais, tipo errado), ele é apagado.
 */
export async function confirmAttachmentUpload(params: {
  storage: FileStorage;
  lessonId: string;
  key: string;
  title: string;
  fileName: string;
}) {
  // O caminho precisa ser um dos que NÓS geramos para ESTA aula.
  if (!isAttachmentKeyOfLesson(params.key, params.lessonId)) {
    throw new UserFacingError("Envio inválido. Tente de novo.");
  }
  const lesson = await prisma.lesson.findUnique({ where: { id: params.lessonId }, select: { id: true } });
  if (!lesson) throw new UserFacingError("Aula não encontrada.");

  const info = await params.storage.getObjectInfo(params.key);
  if (!info) {
    throw new UserFacingError("O arquivo não chegou ao armazenamento. Tente enviar de novo.");
  }
  const wrongType = info.contentType !== null && info.contentType !== PDF_CONTENT_TYPE;
  if (info.sizeBytes <= 0 || info.sizeBytes > MAX_PDF_BYTES || wrongType) {
    await params.storage.deleteObject(params.key);
    throw new UserFacingError("O arquivo enviado não é um PDF válido ou passa do tamanho máximo.");
  }

  const fileName = sanitizeFileName(params.fileName);
  const title = (params.title.trim() || titleFromFileName(fileName)).slice(0, MAX_TITLE_LENGTH);
  try {
    return await prisma.lessonAttachment.create({
      data: { lessonId: lesson.id, title, fileName, storageKey: params.key, sizeBytes: info.sizeBytes },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Este arquivo já foi registrado.");
    throw error;
  }
}

/** Apaga um material: primeiro do banco (some da tela na hora), depois o arquivo. */
export async function deleteAttachment(params: { storage: FileStorage | null; attachmentId: string }) {
  let attachment: { storageKey: string; lessonId: string };
  try {
    attachment = await prisma.lessonAttachment.delete({
      where: { id: params.attachmentId },
      select: { storageKey: true, lessonId: true },
    });
  } catch (error) {
    if (isRecordNotFound(error)) throw new UserFacingError("Material não encontrado.");
    throw error;
  }
  await deleteStoredFiles(params.storage, [attachment.storageKey]);
  return attachment;
}

/**
 * Apaga arquivos do armazenamento "sem derrubar" quem chamou: se um falhar, registra no log e
 * segue (o registro no banco já foi apagado; um arquivo órfão não é visível para ninguém).
 */
export async function deleteStoredFiles(storage: FileStorage | null, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (!storage) {
    console.error(`[materiais] Armazenamento indisponível; arquivos não apagados: ${keys.join(", ")}`);
    return;
  }
  for (const key of keys) {
    try {
      await storage.deleteObject(key);
    } catch (error) {
      console.error(`[materiais] Falha ao apagar o arquivo ${key}:`, error);
    }
  }
}

export type AttachmentDownload =
  | { ok: true; url: string }
  | { ok: false; reason: "NOT_FOUND" | "NO_ACCESS" | "STORAGE_UNAVAILABLE" };

/**
 * Link de download de um material, para UMA pessoa.
 *
 * Passos:
 *  1. Acha o material e confere que ele é mesmo da aula/curso do endereço.
 *  2. Confere o acesso à aula (matrícula ativa, aula grátis ou professor/admin).
 *  3. Só então gera o link temporário (5 minutos).
 */
export async function getAttachmentDownloadUrl(params: {
  storage: FileStorage | null;
  attachmentId: string;
  courseSlug: string;
  lessonSlug: string;
  userId: string;
  role: unknown;
  now?: Date;
}): Promise<AttachmentDownload> {
  const attachment = await prisma.lessonAttachment.findUnique({
    where: { id: params.attachmentId },
    select: {
      storageKey: true,
      fileName: true,
      lessonId: true,
      lesson: { select: { slug: true, course: { select: { slug: true } } } },
    },
  });
  if (
    !attachment ||
    attachment.lesson.slug !== params.lessonSlug ||
    attachment.lesson.course.slug !== params.courseSlug
  ) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const result = await getLessonAccessForUser({
    userId: params.userId,
    role: params.role,
    lessonId: attachment.lessonId,
    now: params.now,
  });
  if (!result || !result.access.allowed) {
    return { ok: false, reason: "NO_ACCESS" };
  }

  if (!params.storage) {
    return { ok: false, reason: "STORAGE_UNAVAILABLE" };
  }
  const url = await params.storage.createDownloadUrl({
    key: attachment.storageKey,
    fileName: attachment.fileName,
    contentType: PDF_CONTENT_TYPE,
    expiresInSeconds: DOWNLOAD_LINK_SECONDS,
  });
  return { ok: true, url };
}
