"use client";

/**
 * session-refresher.tsx — Mantém o login do aluno renovado enquanto ele usa o site.
 *
 * Quem chama: os layouts das áreas logadas (`src/app/area-do-aluno/layout.tsx` e
 * `src/app/admin/layout.tsx`). Não mostra nada na tela (devolve `null`).
 *
 * Por que existe: o login dura 7 dias e deve ser renovado a cada dia de uso. A renovação
 * precisa gravar um cookie novo no navegador, e isso só pode acontecer numa rota da API
 * (não durante a renderização da página no servidor). O `useSession` chama
 * GET /api/auth/get-session ao abrir a página e quando o aluno volta para a aba;
 * se o login tiver mais de 1 dia, o Better Auth renova o banco E o cookie juntos.
 */
import { authClient } from "../auth-client";

export function SessionRefresher() {
  authClient.useSession();
  return null;
}
