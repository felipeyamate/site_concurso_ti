"use client";

/**
 * import-form.tsx — Enviar a planilha (CSV) de questões e ver o resultado (ou os erros por linha).
 *
 * Quem chama: /admin/questoes/importar.
 * A leitura e a conferência ficam no servidor (`importQuestionsAction`): tudo ou nada.
 */
import { useActionState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { importQuestionsAction, type ImportState } from "../actions";

export function ImportForm() {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importQuestionsAction, { status: "idle" });

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="import-file">Planilha em CSV</Label>
          <Input id="import-file" name="file" type="file" accept=".csv,text/csv" required />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Conferindo..." : "Importar"}
        </Button>
      </form>

      {state.status === "success" ? (
        <Alert role="status">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.status === "error" ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{state.message}</AlertTitle>
          {state.errors.length > 0 ? (
            <AlertDescription>
              <ul className="list-disc pl-4">
                {state.errors.map((error, index) => (
                  <li key={`${error.line}-${index}`}>
                    Linha {error.line}: {error.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}
