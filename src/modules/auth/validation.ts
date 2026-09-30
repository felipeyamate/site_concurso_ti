/**
 * validation.ts — Regras dos formulários de autenticação (o que é um e-mail/senha válido).
 *
 * Quem chama: os formulários em `src/modules/auth/components/`, antes de enviar os dados.
 * O que devolve: schemas do zod e a função `getFieldErrors`.
 *
 * Por que validar no navegador se o servidor também valida? Para dar a resposta na hora
 * ("a senha precisa de 8 caracteres") sem esperar a rede. O servidor (Better Auth)
 * continua validando de novo — o navegador nunca é confiável sozinho.
 *
 * Paralelo em Python: cada schema é como um modelo do pydantic; `safeParse` é como
 * `Model.model_validate(...)` dentro de um try/except ValidationError.
 */
import { z } from "zod";

// Primeiro limpa (tira espaços, deixa minúsculo) e SÓ DEPOIS valida o formato.
// Assim um e-mail colado com espaço no fim ("maria@x.com ") é aceito.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Informe um e-mail válido." }));

const password = z
  .string()
  .min(8, { error: "A senha precisa ter pelo menos 8 caracteres." })
  .max(128, { error: "A senha pode ter no máximo 128 caracteres." });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Informe sua senha." }),
});

export const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { error: "Informe seu nome." })
      .max(100, { error: "Nome muito longo." }),
    email,
    password,
    confirmPassword: z.string(),
    // Fase 7 (LGPD): o aceite dos Termos e da Política de privacidade é obrigatório para criar a conta.
    acceptLegal: z.literal(true, { error: "Para criar a conta, aceite os Termos de uso e a Política de privacidade." }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: "As senhas não são iguais.",
    path: ["confirmPassword"],
  });

export const emailOnlySchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: "As senhas não são iguais.",
    path: ["confirmPassword"],
  });

/**
 * Transforma o erro do zod num dicionário simples { campo: "mensagem" },
 * que o formulário usa para mostrar o erro embaixo de cada campo.
 * Se um campo tiver vários erros, mostramos só o primeiro.
 */
export function getFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!(field in fieldErrors)) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}
