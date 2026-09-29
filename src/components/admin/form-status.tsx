/**
 * form-status.tsx — Mensagem do resultado de um formulário do painel ("Curso salvo." / erro).
 *
 * Quem chama: os formulários do painel admin.
 */
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormState } from "@/lib/form-state";

export function FormStatus({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }
  return (
    <Alert variant={state.status === "error" ? "destructive" : "default"} role="status">
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

/** Mensagem de erro embaixo de um campo. */
export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="text-destructive text-sm">
      {message}
    </p>
  );
}
