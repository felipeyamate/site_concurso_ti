/**
 * form-field.tsx — Um campo de formulário completo: rótulo + caixa de texto + mensagem de erro.
 *
 * Quem chama: todos os formulários de autenticação desta pasta.
 * Existe para não repetir as mesmas 10 linhas em cada campo de cada formulário.
 */
import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string | undefined;
};

export function FormField({ id, label, error, ...inputProps }: FormFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        // Acessibilidade: leitores de tela anunciam o erro junto com o campo.
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
