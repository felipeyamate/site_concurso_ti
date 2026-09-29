"use client";

/**
 * attachment-manager.tsx — "Materiais da aula (PDF)" no painel: lista, envio e exclusão.
 *
 * Quem chama: /admin/cursos/[id]/aulas/[aulaId].
 *
 * Envio em 3 passos (o PDF vai do navegador DIRETO para o armazenamento, sem passar pelo nosso
 * servidor — assim não há limite de tamanho da Vercel no caminho):
 *  1. pede ao servidor um link de envio temporário (`prepareAttachmentUploadAction`);
 *  2. envia o arquivo para esse link (requisição PUT, como um `requests.put(url, data=arquivo)`);
 *  3. avisa o servidor, que confere o arquivo e registra o material (`confirmAttachmentUploadAction`).
 */
import { FileText, Trash2 } from "lucide-react";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { ActionButton } from "@/components/admin/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { confirmAttachmentUploadAction, deleteAttachmentAction, prepareAttachmentUploadAction } from "../actions";
import { MAX_PDF_BYTES, formatFileSize, validatePdfUpload } from "../rules";

type Attachment = { id: string; title: string; fileName: string; sizeBytes: number };

type AttachmentManagerProps = {
  lessonId: string;
  attachments: Attachment[];
  storageAvailable: boolean;
};

export function AttachmentManager({ lessonId, attachments, storageAvailable }: AttachmentManagerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const titleInput = form.elements.namedItem("title") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setMessage({ type: "error", text: "Escolha um arquivo PDF." });
      return;
    }
    // Validação rápida aqui (o servidor valida de novo).
    const problem = validatePdfUpload({ fileName: file.name, sizeBytes: file.size, contentType: file.type });
    if (problem) {
      setMessage({ type: "error", text: problem });
      return;
    }

    setMessage(null);
    startTransition(async () => {
      // 1. Link de envio.
      const prepared = await prepareAttachmentUploadAction({
        lessonId,
        fileName: file.name,
        sizeBytes: file.size,
        contentType: file.type,
      });
      if (!prepared.ok) {
        setMessage({ type: "error", text: prepared.error });
        return;
      }

      // 2. Envio direto para o armazenamento.
      try {
        const response = await fetch(prepared.target.url, {
          method: prepared.target.method,
          headers: prepared.target.headers,
          body: file,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch {
        setMessage({
          type: "error",
          text: "Não foi possível enviar o arquivo. Confira a internet e tente de novo (no R2, confira também o CORS do bucket).",
        });
        return;
      }

      // 3. Confirmação e registro.
      const confirmed = await confirmAttachmentUploadAction({
        lessonId,
        key: prepared.key,
        title: titleInput?.value ?? "",
        fileName: file.name,
      });
      if (!confirmed.ok) {
        setMessage({ type: "error", text: confirmed.error });
        return;
      }
      formRef.current?.reset();
      setMessage({ type: "success", text: "Material enviado." });
    });
  }

  return (
    <div className="grid gap-4">
      {attachments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum material nesta aula ainda.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{attachment.title}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {attachment.fileName} · {formatFileSize(attachment.sizeBytes)}
                  </span>
                </span>
              </span>
              <ActionButton
                action={deleteAttachmentAction}
                fields={{ id: attachment.id }}
                variant="ghost"
                size="sm"
                confirmMessage={`Apagar o material "${attachment.title}"? O arquivo será removido.`}
              >
                <Trash2 />
                Apagar
              </ActionButton>
            </li>
          ))}
        </ul>
      )}

      {storageAvailable ? (
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-3 rounded-md border p-3">
          <p className="text-sm font-medium">Enviar novo PDF (até {formatFileSize(MAX_PDF_BYTES)})</p>
          <div className="grid gap-2">
            <Label htmlFor="attachment-title">Título para o aluno (opcional)</Label>
            <Input id="attachment-title" name="title" placeholder="Ex.: Resumo da aula" maxLength={150} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="attachment-file">Arquivo PDF</Label>
            <Input id="attachment-file" name="file" type="file" accept="application/pdf,.pdf" required />
          </div>
          {message ? (
            <p role="status" className={message.type === "error" ? "text-destructive text-sm" : "text-sm text-green-700 dark:text-green-400"}>
              {message.text}
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Enviando..." : "Enviar PDF"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
          O envio de PDFs está desligado: o armazenamento (Cloudflare R2) não está configurado. Veja o README, seção da Fase 3.
        </p>
      )}
    </div>
  );
}
