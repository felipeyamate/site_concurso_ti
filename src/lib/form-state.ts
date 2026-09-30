/**
 * form-state.ts — O "resultado" padrão dos formulários do painel e o erro que pode ir para a tela.
 *
 * Quem usa: as Server Actions do painel admin (devolvem um `FormState`) e os formulários no
 * navegador (mostram a mensagem e os erros por campo).
 *
 * Por que um erro próprio (`UserFacingError`): separa os erros ESPERADOS ("já existe um curso com
 * este endereço"), cuja mensagem pode aparecer para quem usa o painel, dos erros inesperados
 * (banco fora do ar, bug), que vão só para o log com uma mensagem genérica na tela.
 * Paralelo em Python: como levantar um `ValidationError` do Django em vez de um `Exception` qualquer.
 */
import type { z } from "zod";

export type FieldErrors = Record<string, string>;

export type FormState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: FieldErrors;
  // Opcional: uma lista de detalhes embaixo da mensagem (ex.: os erros por linha da planilha).
  details?: string[];
};

export const initialFormState: FormState = { status: "idle", message: null, fieldErrors: {} };

export class UserFacingError extends Error {
  // Campo do formulário ao qual o erro se refere (ex.: "slug"), quando houver.
  readonly field: string | undefined;

  constructor(message: string, options?: { field?: string }) {
    super(message);
    this.name = "UserFacingError";
    this.field = options?.field;
  }
}

export function successState(message: string): FormState {
  return { status: "success", message, fieldErrors: {} };
}

export function errorState(message: string, fieldErrors: FieldErrors = {}, details?: string[]): FormState {
  return details ? { status: "error", message, fieldErrors, details } : { status: "error", message, fieldErrors };
}

/** Erros do zod → a PRIMEIRA mensagem de cada campo (a tela mostra uma por campo). */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
}

/** Resultado de validação que falhou → `FormState` com os erros por campo. */
export function invalidState(error: z.ZodError): FormState {
  return errorState("Confira os campos destacados.", toFieldErrors(error));
}

/** Converte o `FormData` (formulário HTML) num objeto simples, para o zod validar. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") values[name] = value;
  }
  return values;
}

/**
 * Lê o formulário HTML num objeto. Diferente de `formDataToObject`, junta os campos repetidos
 * (várias caixas marcadas com o mesmo nome, ex.: `courseIds`) numa lista.
 */
export function formDataWithLists(formData: FormData, listFields: string[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (listFields.includes(name)) {
      values[name] = [...((values[name] as string[] | undefined) ?? []), value];
    } else {
      values[name] = value;
    }
  }
  for (const name of listFields) values[name] ??= [];
  return values;
}

/**
 * Converte um erro qualquer em `FormState`.
 * Erro esperado → mensagem dele (e o campo, se houver). Inesperado → log + mensagem genérica.
 */
export function stateFromError(error: unknown, context: string): FormState {
  if (error instanceof UserFacingError) {
    return errorState(error.message, error.field ? { [error.field]: error.message } : {});
  }
  console.error(`[admin] Falha em ${context}:`, error);
  return errorState("Algo deu errado. Tente de novo; se continuar, veja o log do servidor.");
}
