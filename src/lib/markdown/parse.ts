/**
 * parse.ts — Lê um texto em "Markdown simples" e devolve a estrutura (árvore) do documento.
 *
 * Quem chama: o componente `Markdown` (posts do blog e páginas de edital) e o painel (prévia).
 * Arquivo "puro", testado em `parse.test.ts`.
 *
 * Por que um leitor próprio: é pouco código e, principalmente, SEGURO — o resultado é uma árvore
 * de dados (título, parágrafo, lista...), nunca HTML pronto. O componente monta os elementos do
 * React a partir dela, então um texto como "<script>" aparece escrito na tela e não roda.
 * Paralelo em Python: é como usar a biblioteca `markdown` com o HTML desligado.
 *
 * O que entende (o suficiente para artigos):
 *  - "## Título" (h2) e "### Subtítulo" (h3) — "#" sozinho também vira h2 (o h1 é o título da página);
 *  - parágrafos (linhas seguidas; uma linha em branco separa);
 *  - listas com "- " ou "* " e numeradas com "1. ";
 *  - citação com "> ";
 *  - bloco de código entre ``` e ```;
 *  - linha "---" (separador);
 *  - dentro do texto: **negrito**, *itálico* (ou _itálico_), `código` e [link](endereço).
 *    Links só para https://, http://, mailto:, "/" (páginas do site) ou "#" (âncoras).
 */
import { safeRedirectPath } from "@/modules/auth/redirect";

export type Inline =
  | { type: "text"; value: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; external: boolean; children: Inline[] };

export type Block =
  | { type: "heading"; level: 2 | 3; id: string; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; children: Inline[] }
  | { type: "code"; value: string }
  | { type: "rule" };

// Um pedaço especial do texto, na ordem de prioridade: código, negrito, link, itálico (* ou _).
const INLINE_PATTERN = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(\[[^\]\n]+\]\([^)\s]+\))|(\*[^*\s][^*\n]*?\*)|((?<![\p{L}\p{N}])_[^_\s][^_\n]*?_(?![\p{L}\p{N}]))/u;

/**
 * Endereço de link aceito? (Nada de "javascript:" e afins.)
 * Caminho do site: a MESMA conferência do login (`safeRedirectPath`) — recusa "//outro-site" e
 * "/\\outro-site" (o navegador trata os dois como outro site) e caracteres de controle.
 */
export function isSafeHref(href: string): boolean {
  if (/^(https?:\/\/|mailto:)/i.test(href) || href.startsWith("#")) return true;
  return href.startsWith("/") && safeRedirectPath(href, "") === href;
}

/**
 * Lê o texto de uma linha/parágrafo em pedaços (texto, negrito, itálico, código, link).
 * Passos: acha o PRIMEIRO pedaço especial; o que vem antes é texto comum; o pedaço é lido (e o
 * conteúdo dele, de novo, recursivamente); repete com o que sobrou.
 */
export function parseInline(text: string): Inline[] {
  const result: Inline[] = [];
  let rest = text;
  while (rest.length > 0) {
    const match = INLINE_PATTERN.exec(rest);
    if (!match) {
      result.push({ type: "text", value: rest });
      break;
    }
    if (match.index > 0) result.push({ type: "text", value: rest.slice(0, match.index) });
    const token = match[0];
    if (match[1]) {
      result.push({ type: "code", value: token.slice(1, -1) });
    } else if (match[2]) {
      result.push({ type: "strong", children: parseInline(token.slice(2, -2)) });
    } else if (match[3]) {
      const closeBracket = token.indexOf("](");
      const label = token.slice(1, closeBracket);
      const href = token.slice(closeBracket + 2, -1);
      if (isSafeHref(href)) {
        result.push({ type: "link", href, external: /^https?:\/\//i.test(href), children: parseInline(label) });
      } else {
        result.push({ type: "text", value: label }); // endereço suspeito: fica só o texto
      }
    } else {
      result.push({ type: "em", children: parseInline(token.slice(1, -1)) });
    }
    rest = rest.slice(match.index + token.length);
  }
  return mergeText(result);
}

// Junta textos vizinhos ("a" + "b" → "ab"): a árvore fica mais simples de testar e de mostrar.
function mergeText(items: Inline[]): Inline[] {
  const merged: Inline[] = [];
  for (const item of items) {
    const last = merged.at(-1);
    if (item.type === "text" && last?.type === "text") last.value += item.value;
    else merged.push(item);
  }
  return merged;
}

/** O texto "limpo" de uma lista de pedaços (sem marcações). */
export function inlineToText(items: Inline[]): string {
  return items.map((item) => (item.type === "text" || item.type === "code" ? item.value : inlineToText(item.children))).join("");
}

/** "Como funciona o Pix?" → "como-funciona-o-pix" (âncora do título: /blog/post#como-funciona-o-pix). */
export function headingId(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "secao"
  );
}

// "## Título" ou "## Título ##". Os "#" de fechamento só contam depois de um ESPAÇO (como no Markdown
// padrão): "## Linguagem C#" continua terminando em "C#".
const HEADING = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/;
const UNORDERED_ITEM = /^[-*]\s+(.*)$/;
const ORDERED_ITEM = /^\d{1,3}[.)]\s+(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;

/**
 * Lê o documento inteiro, linha a linha, em blocos.
 * Cada linha "abre" um tipo de bloco pelo começo dela; linhas seguidas do mesmo tipo se juntam
 * (itens da lista, linhas do parágrafo, linhas da citação). Um bloco de código vai até o ```.
 */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const usedIds = new Set<string>();
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];

  function flush() {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ")) });
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items.map((item) => parseInline(item)) });
    if (quote.length > 0) blocks.push({ type: "quote", children: parseInline(quote.join(" ")) });
    paragraph = [];
    list = null;
    quote = [];
  }

  // Âncoras únicas: o segundo "Resumo" vira "resumo-2". Confere o endereço FINAL (não só o
  // título): com "Resumo", "Resumo" e "Resumo 2", o terceiro vira "resumo-2-2", nunca um repetido.
  function uniqueId(text: string): string {
    const base = headingId(text);
    let candidate = base;
    for (let counter = 2; usedIds.has(candidate); counter += 1) candidate = `${base}-${counter}`;
    usedIds.add(candidate);
    return candidate;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flush();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", value: code.join("\n") });
      continue;
    }
    if (trimmed === "") {
      flush();
      continue;
    }
    const heading = HEADING.exec(trimmed);
    if (heading) {
      flush();
      const children = parseInline(heading[2]);
      blocks.push({ type: "heading", level: heading[1].length >= 3 ? 3 : 2, id: uniqueId(inlineToText(children)), children });
      continue;
    }
    if (RULE.test(trimmed)) {
      flush();
      blocks.push({ type: "rule" });
      continue;
    }
    if (trimmed.startsWith(">")) {
      if (paragraph.length > 0 || list) flush();
      quote.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }
    const unordered = UNORDERED_ITEM.exec(trimmed);
    const ordered = unordered ? null : ORDERED_ITEM.exec(trimmed);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      if (paragraph.length > 0 || quote.length > 0 || (list && list.ordered !== isOrdered)) flush();
      list ??= { ordered: isOrdered, items: [] };
      list.items.push((unordered ?? ordered)![1]);
      continue;
    }
    // Linha comum: continua a lista (item quebrado em 2 linhas), a citação ou o parágrafo.
    if (list && /^\s{2,}/.test(line)) {
      list.items[list.items.length - 1] += ` ${trimmed}`;
      continue;
    }
    if (list || quote.length > 0) flush();
    paragraph.push(trimmed);
  }
  flush();
  return blocks;
}

/** Os títulos (h2) do documento, para um "Neste artigo" com âncoras. */
export function extractHeadings(blocks: Block[]): Array<{ id: string; text: string }> {
  return blocks.flatMap((block) => (block.type === "heading" && block.level === 2 ? [{ id: block.id, text: inlineToText(block.children) }] : []));
}

/** Texto corrido, sem marcações (resumo automático, leitura estimada, RSS). */
export function markdownToPlainText(source: string): string {
  return parseMarkdown(source)
    .map((block) => {
      switch (block.type) {
        case "heading":
        case "paragraph":
        case "quote":
          return inlineToText(block.children);
        case "list":
          return block.items.map((item) => inlineToText(item)).join(" ");
        case "code":
          return block.value;
        case "rule":
          return "";
      }
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Minutos de leitura (200 palavras por minuto; no mínimo 1). */
export function readingMinutes(source: string): number {
  const words = markdownToPlainText(source).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Corta um texto em até `max` caracteres, sem partir palavra, com "…" no fim se cortou. */
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
