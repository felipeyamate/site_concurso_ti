/**
 * markdown.tsx — Mostra um texto em Markdown simples (posts do blog, páginas de edital, prévia no painel).
 *
 * Quem chama: /blog/[post], /concursos/[edital] e a prévia dos formulários do painel.
 * Recebe o texto, lê com `parseMarkdown` e monta os elementos do React bloco a bloco.
 *
 * Segurança: nada de `dangerouslySetInnerHTML` — tudo vira elemento do React, que escapa o texto.
 * Links externos abrem em outra aba, com `noopener noreferrer` (a página aberta não controla a nossa).
 * Sem "use client": funciona tanto em páginas do servidor quanto dentro de componentes do navegador.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { parseMarkdown, type Block, type Inline } from "./parse";

function renderInline(items: Inline[], keyPrefix: string): ReactNode[] {
  return items.map((item, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (item.type) {
      case "text":
        return item.value;
      case "strong":
        return <strong key={key}>{renderInline(item.children, key)}</strong>;
      case "em":
        return <em key={key}>{renderInline(item.children, key)}</em>;
      case "code":
        return (
          <code key={key} className="bg-muted rounded px-1 py-0.5 font-mono text-[0.9em]">
            {item.value}
          </code>
        );
      case "link":
        if (item.external || item.href.startsWith("mailto:")) {
          return (
            <a key={key} href={item.href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              {renderInline(item.children, key)}
            </a>
          );
        }
        return (
          <Link key={key} href={item.href} className="text-primary underline underline-offset-2">
            {renderInline(item.children, key)}
          </Link>
        );
    }
  });
}

function renderBlock(block: Block, index: number): ReactNode {
  const key = `b${index}`;
  switch (block.type) {
    case "heading":
      return block.level === 2 ? (
        <h2 key={key} id={block.id} className="mt-6 scroll-mt-20 text-xl font-semibold tracking-tight">
          {renderInline(block.children, key)}
        </h2>
      ) : (
        <h3 key={key} id={block.id} className="mt-4 scroll-mt-20 text-lg font-semibold">
          {renderInline(block.children, key)}
        </h3>
      );
    case "paragraph":
      return (
        <p key={key} className="leading-relaxed">
          {renderInline(block.children, key)}
        </p>
      );
    case "list": {
      const items = block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>);
      return block.ordered ? (
        <ol key={key} className="grid list-decimal gap-1 pl-6 leading-relaxed">
          {items}
        </ol>
      ) : (
        <ul key={key} className="grid list-disc gap-1 pl-6 leading-relaxed">
          {items}
        </ul>
      );
    }
    case "quote":
      return (
        <blockquote key={key} className="border-primary/40 text-muted-foreground border-l-4 pl-4 italic">
          {renderInline(block.children, key)}
        </blockquote>
      );
    case "code":
      return (
        <pre key={key} className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-sm">
          <code>{block.value}</code>
        </pre>
      );
    case "rule":
      return <hr key={key} className="my-2" />;
  }
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  return <div className={cn("grid gap-4 text-base", className)}>{parseMarkdown(source).map(renderBlock)}</div>;
}
