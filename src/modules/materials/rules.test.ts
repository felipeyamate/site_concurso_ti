/**
 * rules.test.ts — Testes das regras de envio de PDFs.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { formatFileSize, MAX_PDF_BYTES, validatePdfUpload } from "./rules";

describe("validatePdfUpload", () => {
  const pdf = { fileName: "Resumo.PDF", sizeBytes: 1000, contentType: "application/pdf" };

  it("aceita PDF dentro do limite (inclusive quando o navegador não informa o tipo)", () => {
    expect(validatePdfUpload(pdf)).toBeNull();
    expect(validatePdfUpload({ ...pdf, contentType: "" })).toBeNull();
    expect(validatePdfUpload({ ...pdf, sizeBytes: MAX_PDF_BYTES })).toBeNull();
  });

  it("recusa outros tipos, arquivo vazio e arquivo grande demais", () => {
    expect(validatePdfUpload({ ...pdf, fileName: "virus.exe" })).toMatch(/PDF/);
    expect(validatePdfUpload({ ...pdf, contentType: "text/html" })).toMatch(/PDF/);
    expect(validatePdfUpload({ ...pdf, sizeBytes: 0 })).toMatch(/vazio/);
    expect(validatePdfUpload({ ...pdf, sizeBytes: MAX_PDF_BYTES + 1 })).toMatch(/50 MB/);
  });
});

describe("formatFileSize", () => {
  it("mostra o tamanho no padrão brasileiro", () => {
    expect(formatFileSize(500)).toBe("500 bytes");
    expect(formatFileSize(1536)).toBe("1,5 KB");
    expect(formatFileSize(50 * 1024 * 1024)).toBe("50 MB");
  });
});
