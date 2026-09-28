/**
 * form-message.tsx — Aviso no topo de um formulário (erro geral ou mensagem de sucesso).
 *
 * Quem chama: os formulários de autenticação desta pasta.
 */
import { Alert, AlertDescription } from "@/components/ui/alert";

type FormMessageProps = {
  type: "error" | "success";
  message: string | null;
};

export function FormMessage({ type, message }: FormMessageProps) {
  if (!message) {
    return null;
  }
  return (
    <Alert variant={type === "error" ? "destructive" : "default"}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
