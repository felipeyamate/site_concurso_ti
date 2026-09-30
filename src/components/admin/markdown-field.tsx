"use client";

/**
 * markdown-field.tsx — Campo de texto em Markdown com o botão "Prévia" (mostra como vai ficar).
 *
 * Quem chama: os formulários do blog e das páginas de edital no painel.
 * A prévia usa o MESMO componente da página pública (`Markdown`), então o que aparece aqui é o
 * que o aluno vai ver. Também mostra uma "cola" das marcações aceitas.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/lib/markdown/markdown";

export function MarkdownField({
  id,
  name,
  label,
  defaultValue,
  rows = 16,
  error,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  rows?: number;
  error?: string;
}) {
  const [text, setText] = useState(defaultValue);
  const [preview, setPreview] = useState(false);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => setPreview((value) => !value)}>
          {preview ? "Voltar a editar" : "Prévia"}
        </Button>
      </div>
      {/* O campo continua no formulário mesmo durante a prévia (escondido), para ser enviado. */}
      <Textarea
        id={id}
        name={name}
        rows={rows}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className={preview ? "hidden" : "font-mono text-sm"}
        aria-invalid={error ? true : undefined}
      />
      {preview ? (
        <div className="rounded-md border p-4" data-testid="markdown-preview">
          <Markdown source={text} />
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Formatação: <code>## Título</code>, <code>### Subtítulo</code>, <code>**negrito**</code>, <code>*itálico*</code>,{" "}
          <code>[link](https://...)</code> ou <code>[link](/cursos/...)</code>, listas com <code>- </code> ou <code>1. </code>,{" "}
          <code>&gt; citação</code> e uma linha em branco entre parágrafos.
        </p>
      )}
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
