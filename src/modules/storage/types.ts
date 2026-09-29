/**
 * types.ts — O "contrato" do armazenamento de arquivos (onde ficam os PDFs das aulas).
 *
 * Quem usa: `storage.server.ts` escolhe a implementação (R2 ou pasta local); o módulo de
 * materiais (`src/modules/materials`) só conversa com este contrato.
 *
 * Mesmo princípio do vídeo (PROJECT.md, seção 4): trocar de fornecedor muda um arquivo só.
 * Paralelo em Python: é uma classe abstrata (`abc.ABC`) com dois "backends" — como os storages
 * do Django (`FileSystemStorage` e o `S3Boto3Storage` do django-storages).
 *
 * Por que "links assinados": o arquivo nunca passa pelo nosso servidor. O navegador envia o PDF
 * direto para o armazenamento (link de ENVIO, vale 10 min) e o aluno baixa direto de lá (link de
 * DOWNLOAD, vale 5 min, gerado só depois de conferir o acesso). Assim não há limite de tamanho da
 * Vercel no caminho e ninguém consegue um link permanente para o arquivo.
 */

// Como o navegador deve enviar o arquivo (requisição HTTP PUT para `url`, com estes cabeçalhos).
export type UploadTarget = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

// O que o armazenamento sabe sobre um arquivo já enviado.
export type StoredObjectInfo = {
  sizeBytes: number;
  // Tipo informado no envio (ex.: "application/pdf"). `null` quando o armazenamento não guarda.
  contentType: string | null;
};

export type StorageKind = "R2" | "LOCAL";

export interface FileStorage {
  readonly kind: StorageKind;

  /**
   * Link temporário para o NAVEGADOR enviar o arquivo direto para o armazenamento.
   * O tipo E o tamanho EXATO (`sizeBytes`, já validado) entram na assinatura: o link só aceita
   * aquele arquivo. Assim, reusar o link depois da confirmação (ele vale 10 min) não consegue
   * trocar o PDF conferido por um arquivo maior ou de outro tipo.
   */
  createUploadTarget(params: {
    key: string;
    contentType: string;
    sizeBytes: number;
    expiresInSeconds: number;
  }): Promise<UploadTarget>;

  /** Confere se o arquivo chegou (e com que tamanho). `null` se não existe. */
  getObjectInfo(key: string): Promise<StoredObjectInfo | null>;

  /** Link temporário para BAIXAR/abrir o arquivo. Só chame depois de conferir o acesso! */
  createDownloadUrl(params: {
    key: string;
    fileName: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<string>;

  /** Apaga o arquivo (não dá erro se ele já não existir). */
  deleteObject(key: string): Promise<void>;
}
