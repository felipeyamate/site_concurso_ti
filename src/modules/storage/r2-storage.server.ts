/**
 * r2-storage.server.ts — Armazenamento de arquivos no Cloudflare R2 (produção).
 *
 * Quem chama: `storage.server.ts`, quando as variáveis R2_* estão preenchidas.
 *
 * O R2 "fala" a mesma língua do Amazon S3, então usamos o SDK oficial da AWS apontado para o
 * endereço do R2. Paralelo em Python: é o `boto3.client("s3", endpoint_url=...)` com
 * `generate_presigned_url(...)`.
 *
 * Configuração necessária no painel da Cloudflare (passo a passo no README):
 *  - um bucket PRIVADO (sem acesso público);
 *  - um token de API do R2 com permissão de leitura e escrita nesse bucket;
 *  - uma regra de CORS no bucket liberando PUT a partir do endereço do site (o navegador envia
 *    o PDF direto para o R2).
 */
import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { buildContentDisposition } from "./files";
import type { FileStorage, StoredObjectInfo } from "./types";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

// O SDK responde "não encontrado" de formas diferentes conforme o comando; conferimos as duas.
function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = "name" in error ? error.name : undefined;
  const status =
    "$metadata" in error && typeof error.$metadata === "object" && error.$metadata !== null
      ? (error.$metadata as { httpStatusCode?: number }).httpStatusCode
      : undefined;
  return name === "NotFound" || name === "NoSuchKey" || status === 404;
}

export function createR2Storage(config: R2Config): FileStorage {
  const client = new S3Client({
    region: "auto", // o R2 não tem regiões como a AWS; "auto" é o valor indicado pela Cloudflare
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // As versões novas do SDK acrescentam "checksums" aos links assinados, e aí o envio feito pelo
    // navegador é recusado. "WHEN_REQUIRED" = só quando a operação exige (recomendação da Cloudflare).
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return {
    kind: "R2",

    async createUploadTarget({ key, contentType, expiresInSeconds }) {
      // O tipo do arquivo entra na assinatura: o navegador precisa enviar exatamente esse tipo.
      // O tamanho é conferido depois do envio (`getObjectInfo`), antes de salvar no banco.
      const command = new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType });
      const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
      return { url, method: "PUT", headers: { "Content-Type": contentType } };
    },

    async getObjectInfo(key): Promise<StoredObjectInfo | null> {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
        return { sizeBytes: head.ContentLength ?? 0, contentType: head.ContentType ?? null };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async createDownloadUrl({ key, fileName, contentType, expiresInSeconds }) {
      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        // Força o tipo e o nome no download, qualquer que seja o que ficou gravado.
        ResponseContentType: contentType,
        ResponseContentDisposition: buildContentDisposition(fileName),
      });
      return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    },

    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}
