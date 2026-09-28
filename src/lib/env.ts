/**
 * env.ts — Lê e valida as variáveis de ambiente (configurações e segredos) do servidor.
 *
 * Quem chama: qualquer código de servidor que precise de uma configuração
 * (ex.: `src/lib/db.ts`, `src/modules/auth/auth.ts`, `src/modules/email/send-email.ts`).
 * O que devolve: o objeto `env`, já validado e tipado.
 *
 * Por que validar: se faltar uma variável (ex.: DATABASE_URL), é melhor o app parar logo ao
 * iniciar, com uma mensagem clara, do que quebrar no meio de um login de aluno.
 *
 * Paralelo em Python: é o mesmo papel do `pydantic-settings` (`class Settings(BaseSettings)`).
 * O `zod` aqui funciona como o `pydantic`: descreve o formato esperado e valida.
 *
 * IMPORTANTE: este arquivo só pode rodar no servidor (tem segredos). O `import "server-only"`
 * faz o build falhar se algum componente de navegador tentar importá-lo.
 */
import "server-only";

import { parseEnv } from "@/lib/env-schema";

export type { Env } from "@/lib/env-schema";

// Validado uma única vez, quando o módulo é carregado pela primeira vez.
export const env = parseEnv(process.env);
