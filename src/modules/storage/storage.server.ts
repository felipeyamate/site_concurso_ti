/**
 * storage.server.ts — Escolhe o armazenamento de arquivos em uso: Cloudflare R2 ou pasta local.
 *
 * Quem chama: o módulo de materiais (envio, download e exclusão de PDFs) e o painel admin
 * (para mostrar se o armazenamento está configurado).
 * O que devolve: um `FileStorage` pronto para usar, ou `null` se não há armazenamento disponível.
 *
 * Regra:
 *  1. R2 configurado (as 4 variáveis R2_*)  → R2 (em qualquer ambiente).
 *  2. Senão, fora de produção               → pasta local (LOCAL_STORAGE_DIR).
 *  3. Senão (produção sem R2)                → `null`: o envio de PDFs fica desligado, com aviso.
 *
 * Paralelo em Python: como escolher o `DEFAULT_FILE_STORAGE` no `settings.py` conforme o ambiente.
 */
import "server-only";

import { env } from "@/lib/env";

import { createLocalStorage } from "./local-storage.server";
import { createR2Storage } from "./r2-storage.server";
import type { FileStorage, StorageKind } from "./types";

let cached: FileStorage | null | undefined;

export function getFileStorage(): FileStorage | null {
  if (cached !== undefined) return cached;

  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET) {
    cached = createR2Storage({
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
    });
  } else if (env.NODE_ENV !== "production") {
    cached = createLocalStorage({ rootDir: env.LOCAL_STORAGE_DIR, secret: env.BETTER_AUTH_SECRET });
  } else {
    cached = null;
  }
  return cached;
}

/** Qual armazenamento está em uso (para o painel mostrar). */
export function getStorageKind(): StorageKind | null {
  return getFileStorage()?.kind ?? null;
}
