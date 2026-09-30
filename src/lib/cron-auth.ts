/**
 * cron-auth.ts — Confere se quem chamou uma tarefa agendada é mesmo a Vercel.
 *
 * Quem chama: as rotas /api/cron/... Arquivo sem banco, testado em `cron-auth.test.ts`.
 * Como a Vercel chama: GET com o cabeçalho `Authorization: Bearer <CRON_SECRET>` (o segredo
 * cadastrado nas variáveis do projeto). Sem o segredo configurado, NADA passa.
 *
 * `timingSafeEqual`: compara sem "atalhos" (o tempo da comparação não entrega quantas letras
 * acertaram). Paralelo em Python: `hmac.compare_digest`.
 */
import { timingSafeEqual } from "node:crypto";

export function isAuthorizedCronRequest(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
