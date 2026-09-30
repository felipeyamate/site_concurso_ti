"use client";

/**
 * import-form.tsx — Enviar a planilha (CSV) de questões e ver o resultado (ou os erros por linha).
 *
 * Quem chama: /admin/questoes/importar.
 * A leitura e a conferência ficam no servidor (`importQuestionsAction`): tudo ou nada. Os erros por
 * linha chegam em `state.details` e o `FormStatus` mostra a lista.
 * Antes de enviar, conferimos o tamanho do arquivo aqui mesmo: acima do limite, o Next recusaria o
 * envio inteiro (com um erro genérico) antes de a nossa ação rodar.
 */
import { useState, type FormEvent } from "react";

import { FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorState } from "@/lib/form-state";

import { importQuestionsAction } from "../actions";
import { IMPORT_TOO_LARGE_MESSAGE, MAX_IMPORT_BYTES } from "../../import-questions";

export function ImportForm() {
  const { state, onSubmit, pending, formRef } = useAdminForm(importQuestionsAction, { resetOnSuccess: true });
  const [tooLarge, setTooLarge] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    const input = event.currentTarget.elements.namedItem("file");
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    if (file && file.size > MAX_IMPORT_BYTES) {
      event.preventDefault();
      setTooLarge(true);
      return;
    }
    setTooLarge(false);
    onSubmit(event);
  }

  return (
    <div className="grid gap-4">
      <form ref={formRef} onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="import-file">Planilha em CSV</Label>
          <Input id="import-file" name="file" type="file" accept=".csv,text/csv" required />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Conferindo..." : "Importar"}
        </Button>
      </form>
      <FormStatus state={tooLarge ? errorState(IMPORT_TOO_LARGE_MESSAGE) : state} />
    </div>
  );
}
