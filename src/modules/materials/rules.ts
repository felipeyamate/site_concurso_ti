/**
 * rules.ts — Regras dos materiais em PDF: o que pode ser enviado e como mostrar o tamanho.
 *
 * Quem chama: o formulário de envio no painel (valida antes de enviar, para avisar logo) e o
 * servidor (`materials.server.ts`, que valida de novo — nunca confiamos só no navegador).
 * Arquivo "puro", testado em `rules.test.ts`.
 */

// Limite por arquivo. Apostilas grandes com imagens cabem com folga.
export const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB

// Tipos que os navegadores informam para arquivos .pdf ("" quando o sistema não sabe dizer).
const ACCEPTED_BROWSER_TYPES = new Set(["application/pdf", "application/x-pdf", ""]);

/** Devolve o problema do arquivo (em português) ou `null` se está tudo certo. */
export function validatePdfUpload(file: { fileName: string; sizeBytes: number; contentType: string }): string | null {
  if (!file.fileName.toLowerCase().endsWith(".pdf") || !ACCEPTED_BROWSER_TYPES.has(file.contentType)) {
    return "Envie um arquivo PDF (.pdf).";
  }
  if (!Number.isInteger(file.sizeBytes) || file.sizeBytes <= 0) {
    return "O arquivo está vazio.";
  }
  if (file.sizeBytes > MAX_PDF_BYTES) {
    return `O arquivo passa de ${formatFileSize(MAX_PDF_BYTES)}. Comprima o PDF ou divida em partes.`;
  }
  return null;
}

/** 1536 → "1,5 KB"; 52428800 → "50 MB" (com vírgula, como se escreve no Brasil). */
export function formatFileSize(bytes: number): string {
  const units = ["bytes", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? String(value) : value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${rounded} ${units[unit]}`;
}
