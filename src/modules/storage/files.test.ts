/**
 * files.test.ts — Testes das regras de nomes e caminhos de arquivos.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  buildAttachmentKey,
  buildContentDisposition,
  isAttachmentKeyOfLesson,
  isValidAttachmentKey,
  sanitizeFileName,
  titleFromFileName,
} from "./files";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("caminhos dos materiais", () => {
  it("monta lessons/<aula>/<uuid>.pdf", () => {
    expect(buildAttachmentKey("aula123", UUID)).toBe(`lessons/aula123/${UUID}.pdf`);
  });

  it("recusa caminhos fora do formato (inclusive tentativas de sair da pasta)", () => {
    expect(isValidAttachmentKey(`lessons/aula123/${UUID}.pdf`)).toBe(true);
    expect(isValidAttachmentKey(`lessons/../${UUID}.pdf`)).toBe(false);
    expect(isValidAttachmentKey(`lessons/aula123/../../etc/passwd`)).toBe(false);
    expect(isValidAttachmentKey(`/lessons/aula123/${UUID}.pdf`)).toBe(false);
    expect(isValidAttachmentKey(`lessons/aula123/${UUID}.html`)).toBe(false);
    expect(() => buildAttachmentKey("../x", UUID)).toThrow();
  });

  it("confere se o arquivo é da aula certa", () => {
    const key = buildAttachmentKey("aula123", UUID);
    expect(isAttachmentKeyOfLesson(key, "aula123")).toBe(true);
    expect(isAttachmentKeyOfLesson(key, "outra")).toBe(false);
    expect(isAttachmentKeyOfLesson(key, "aula12")).toBe(false);
  });
});

describe("nomes de arquivo", () => {
  it("tira pastas, aspas e caracteres invisíveis", () => {
    expect(sanitizeFileName("C:\\Users\\ana\\Resumo.pdf")).toBe("Resumo.pdf");
    expect(sanitizeFileName('a"b;c\u0000.pdf')).toBe("abc.pdf");
    expect(sanitizeFileName("   ")).toBe("material.pdf");
  });

  it("sugere um título a partir do nome do arquivo", () => {
    expect(titleFromFileName("Resumo_aula__1.PDF")).toBe("Resumo aula 1");
    expect(titleFromFileName(".pdf")).toBe("Material da aula");
  });

  it("monta o cabeçalho de download com acentos (RFC 6266)", () => {
    const header = buildContentDisposition("Segurança da informação.pdf");
    expect(header).toBe(
      `inline; filename="Seguranca da informacao.pdf"; filename*=UTF-8''Seguran%C3%A7a%20da%20informa%C3%A7%C3%A3o.pdf`,
    );
  });

  it("codifica parênteses e asterisco no nome com acentos (o formato filename* não os aceita)", () => {
    const header = buildContentDisposition("Segurança (resumo)*.pdf");
    expect(header).toBe(
      `inline; filename="Seguranca (resumo)*.pdf"; filename*=UTF-8''Seguran%C3%A7a%20%28resumo%29%2A.pdf`,
    );
  });
});
