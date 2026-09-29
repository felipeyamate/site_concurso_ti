/**
 * local-storage.server.ts — Armazenamento de arquivos numa PASTA LOCAL (só desenvolvimento).
 *
 * Quem chama: `storage.server.ts`, quando o R2 não está configurado e o app NÃO está em produção;
 * e a rota `/api/dev-storage` (que recebe os envios e entrega os downloads).
 *
 * Por que só em desenvolvimento: na Vercel o disco é apagado a cada deploy (e cada requisição pode
 * cair num servidor diferente). Em produção os PDFs ficam no Cloudflare R2.
 *
 * Funciona como o R2 para o resto do app: links temporários e assinados (ver `local-signature.ts`),
 * então as telas e as regras de acesso são testadas de verdade sem precisar da conta no R2.
 */
import "server-only";

import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildContentDisposition, isValidAttachmentKey } from "./files";
import { buildLocalSignedUrl } from "./local-signature";
import type { FileStorage, StoredObjectInfo } from "./types";

type LocalStorageOptions = {
  rootDir: string;
  secret: string;
  now?: () => number; // em milissegundos; trocável nos testes
};

/**
 * Converte o caminho lógico (`lessons/<aula>/<uuid>.pdf`) no caminho real do arquivo no disco.
 * Recusa qualquer coisa fora do formato esperado — nunca sai da pasta raiz (proteção contra "../").
 */
export function resolveLocalPath(rootDir: string, key: string): string {
  if (!isValidAttachmentKey(key)) {
    throw new Error(`Caminho de arquivo inválido: ${key}`);
  }
  const root = path.resolve(rootDir);
  const fullPath = path.resolve(root, key);
  if (!fullPath.startsWith(root + path.sep)) {
    throw new Error(`Caminho fora da pasta de arquivos: ${key}`);
  }
  return fullPath;
}

/** Grava o arquivo recebido pela rota de envio. */
export async function writeLocalObject(rootDir: string, key: string, data: Uint8Array): Promise<void> {
  const fullPath = resolveLocalPath(rootDir, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, data);
}

/** Lê o arquivo para a rota de download. `null` se não existe. */
export async function readLocalObject(rootDir: string, key: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveLocalPath(rootDir, key));
  } catch (error) {
    if (isFileNotFound(error)) return null;
    throw error;
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export function createLocalStorage(options: LocalStorageOptions): FileStorage {
  const now = options.now ?? Date.now;
  const expiresAt = (seconds: number) => Math.floor(now() / 1000) + seconds;

  return {
    kind: "LOCAL",

    async createUploadTarget({ key, contentType, maxBytes, expiresInSeconds }) {
      resolveLocalPath(options.rootDir, key); // valida o caminho já aqui
      const url = buildLocalSignedUrl({
        secret: options.secret,
        operation: "upload",
        key,
        expiresAt: expiresAt(expiresInSeconds),
        extra: { type: contentType, max: String(maxBytes) },
      });
      return { url, method: "PUT", headers: { "Content-Type": contentType } };
    },

    async getObjectInfo(key): Promise<StoredObjectInfo | null> {
      try {
        const info = await stat(resolveLocalPath(options.rootDir, key));
        // O tipo foi conferido na rota de envio (que só aceita o tipo assinado no link).
        return { sizeBytes: info.size, contentType: null };
      } catch (error) {
        if (isFileNotFound(error)) return null;
        throw error;
      }
    },

    async createDownloadUrl({ key, fileName, contentType, expiresInSeconds }) {
      resolveLocalPath(options.rootDir, key);
      return buildLocalSignedUrl({
        secret: options.secret,
        operation: "download",
        key,
        expiresAt: expiresAt(expiresInSeconds),
        extra: { type: contentType, disposition: buildContentDisposition(fileName) },
      });
    },

    async deleteObject(key) {
      try {
        await unlink(resolveLocalPath(options.rootDir, key));
      } catch (error) {
        if (!isFileNotFound(error)) throw error;
      }
    },
  };
}
