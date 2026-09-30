/**
 * parse.test.ts — Markdown simples: blocos, marcações dentro do texto e segurança dos links.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { extractHeadings, isSafeHref, markdownToPlainText, parseInline, parseMarkdown, readingMinutes, truncateText } from "./parse";

describe("parseInline", () => {
  it("negrito, itálico, código e link", () => {
    expect(parseInline("O **Pix** é *instantâneo*, veja `SMTP` e [o edital](https://exemplo.gov.br/edital).")).toEqual([
      { type: "text", value: "O " },
      { type: "strong", children: [{ type: "text", value: "Pix" }] },
      { type: "text", value: " é " },
      { type: "em", children: [{ type: "text", value: "instantâneo" }] },
      { type: "text", value: ", veja " },
      { type: "code", value: "SMTP" },
      { type: "text", value: " e " },
      { type: "link", href: "https://exemplo.gov.br/edital", external: true, children: [{ type: "text", value: "o edital" }] },
      { type: "text", value: "." },
    ]);
  });

  it("marcações dentro de marcações e links internos", () => {
    expect(parseInline("**leia [o curso](/cursos/base)**")).toEqual([
      {
        type: "strong",
        children: [
          { type: "text", value: "leia " },
          { type: "link", href: "/cursos/base", external: false, children: [{ type: "text", value: "o curso" }] },
        ],
      },
    ]);
  });

  it("sublinhado no meio de palavra não vira itálico", () => {
    expect(parseInline("arquivo_de_texto e _destaque_")).toEqual([
      { type: "text", value: "arquivo_de_texto e " },
      { type: "em", children: [{ type: "text", value: "destaque" }] },
    ]);
  });

  it("SEGURANÇA: link com endereço perigoso vira texto; HTML fica como texto", () => {
    // Nenhum link é criado: sobra só texto (o ")" do "alert(1)" fica como texto também).
    const dangerous = parseInline("[clique](javascript:alert(1))");
    expect(dangerous.every((item) => item.type === "text")).toBe(true);
    expect(parseInline("[clique](javascript:void)")).toEqual([{ type: "text", value: "clique" }]);
    expect(parseInline('<script>alert("x")</script>')).toEqual([{ type: "text", value: '<script>alert("x")</script>' }]);
    expect(isSafeHref("//outro-site.com")).toBe(false);
    // "/\\golpe.com" o navegador trata como "//golpe.com" (outro site): recusado, como no login.
    expect(isSafeHref("/\\golpe.com")).toBe(false);
    expect(parseInline("[edital](/\\golpe.com)")).toEqual([{ type: "text", value: "edital" }]);
    expect(isSafeHref("/cursos/base?cupom=BB10#topo")).toBe(true);
    expect(isSafeHref("mailto:contato@exemplo.com")).toBe(true);
    expect(isSafeHref("#resumo")).toBe(true);
  });
});

describe("parseMarkdown", () => {
  const doc = [
    "# O que é phishing",
    "",
    "Golpe que **imita** um site",
    "confiável.",
    "",
    "## Como se proteger",
    "- Desconfie de links",
    "- Confira o endereço",
    "",
    "1. Primeiro",
    "2. Segundo",
    "",
    "> Dica: cai muito na Cesgranrio.",
    "",
    "```",
    "<b>não é HTML</b>",
    "```",
    "",
    "---",
    "## Como se proteger",
  ].join("\n");

  it("blocos: títulos (com âncora única), parágrafo juntando linhas, listas, citação, código e separador", () => {
    const blocks = parseMarkdown(doc);
    expect(blocks.map((block) => block.type)).toEqual(["heading", "paragraph", "heading", "list", "list", "quote", "code", "rule", "heading"]);
    expect(blocks[0]).toMatchObject({ level: 2, id: "o-que-e-phishing" });
    expect(blocks[1]).toEqual({
      type: "paragraph",
      children: [{ type: "text", value: "Golpe que " }, { type: "strong", children: [{ type: "text", value: "imita" }] }, { type: "text", value: " um site confiável." }],
    });
    expect(blocks[3]).toMatchObject({ ordered: false, items: [[{ value: "Desconfie de links" }], [{ value: "Confira o endereço" }]] });
    expect(blocks[4]).toMatchObject({ ordered: true });
    expect(blocks[6]).toEqual({ type: "code", value: "<b>não é HTML</b>" });
    expect(blocks[8]).toMatchObject({ id: "como-se-proteger-2" });
    expect(extractHeadings(blocks).map((heading) => heading.id)).toEqual(["o-que-e-phishing", "como-se-proteger", "como-se-proteger-2"]);
  });

  it("âncoras nunca repetem, mesmo com um título que já termina no número do sufixo", () => {
    const ids = extractHeadings(parseMarkdown("## Resumo\n\n## Resumo\n\n## Resumo 2")).map((heading) => heading.id);
    expect(ids).toEqual(["resumo", "resumo-2", "resumo-2-2"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('título que termina em "#" (C#, F#) não perde o caractere; "##" de fechamento sai', () => {
    expect(parseMarkdown("## Linguagem C#")[0]).toMatchObject({ type: "heading", level: 2, id: "linguagem-c" });
    expect(extractHeadings(parseMarkdown("## F# e C#\n\n## Fechado ##"))).toMatchObject([{ text: "F# e C#" }, { text: "Fechado" }]);
  });

  it("h3 e item de lista quebrado em duas linhas", () => {
    const blocks = parseMarkdown("### Detalhe\n- item longo\n  continua aqui\n- outro");
    expect(blocks[0]).toMatchObject({ type: "heading", level: 3 });
    expect(blocks[1]).toMatchObject({ items: [[{ value: "item longo continua aqui" }], [{ value: "outro" }]] });
  });
});

describe("texto corrido", () => {
  it("sem marcações, leitura estimada e corte sem partir palavra", () => {
    expect(markdownToPlainText("## Título\n\nTexto com **negrito** e [link](/x).")).toBe("Título Texto com negrito e link.");
    expect(readingMinutes("palavra ".repeat(450))).toBe(2);
    expect(readingMinutes("curto")).toBe(1);
    expect(truncateText("Aprenda a diferença entre vírus e worm", 20)).toBe("Aprenda a diferença…");
  });
});
