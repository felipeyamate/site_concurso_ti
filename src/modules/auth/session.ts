/**
 * session.ts — "Quem está logado?" e proteções de página, no SERVIDOR.
 *
 * Quem chama: páginas e Server Actions protegidas, por exemplo:
 *   const { user } = await requireSession("/area-do-aluno");   // exige login
 *   const { user } = await requireRole("ADMIN", "/admin");      // exige perfil mínimo
 * O que devolve: a sessão (usuário + dados do login) ou redireciona/nega o acesso.
 *
 * Esta é a checagem DE VERDADE. O `src/proxy.ts` também redireciona quem não tem cookie,
 * mas ele só olha se o cookie existe (é rápido, porém não confere no banco). Toda página
 * protegida precisa chamar uma das funções abaixo.
 *
 * Fase 7 (LGPD): quem ainda não aceitou a versão ATUAL dos Termos/Política de privacidade (entrou
 * pelo Google/link mágico, ou os textos mudaram) é levado à tela de aceite antes de continuar.
 *
 * Paralelo em Python/Django: `requireSession` ≈ `@login_required`;
 * `requireRole` ≈ `@user_passes_test(...)`.
 */
import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { LEGAL_ACCEPT_PATH, needsLegalAcceptance } from "@/modules/legal/version";

import { auth } from "./auth";
import { RETURN_TO_PARAM, loginPath } from "./redirect";
import { hasMinimumRole, type Role } from "./roles";

/**
 * Lê a sessão atual a partir dos cookies da requisição.
 *
 * `cache` (do React) guarda o resultado durante UMA renderização de página: se o cabeçalho,
 * a página e um componente perguntarem "quem está logado?", o banco é consultado só uma vez.
 * (Parecido com um `functools.lru_cache` que dura só uma requisição.)
 *
 * Por que `disableRefresh: true`: aqui só LEMOS a sessão. Durante a renderização de uma página
 * o Next.js não deixa gravar cookies; se renovássemos aqui, o banco ganharia mais 7 dias mas o
 * cookie do navegador não, e o aluno seria deslogado mesmo usando o site todo dia.
 * Quem renova é o `SessionRefresher` (components/session-refresher.tsx), pelo navegador.
 */
export const getCurrentSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  });
});

/**
 * Exige login. Se não houver sessão válida, manda para /entrar e, depois do login,
 * traz o usuário de volta para `returnTo`.
 * Depois, exige o aceite da versão atual dos Termos/Política: sem ele, manda para a tela de
 * aceite (que traz de volta para `returnTo`). `allowPendingLegal: true` só nas páginas que precisam
 * abrir mesmo sem o aceite: a própria tela de aceite e "Minha conta e privacidade" (quem não
 * concorda com os textos novos precisa conseguir baixar os dados e excluir a conta).
 */
export async function requireSession(returnTo: string, options: { allowPendingLegal?: boolean } = {}) {
  const session = await getCurrentSession();
  if (!session) {
    redirect(loginPath(returnTo));
  }
  if (!options.allowPendingLegal && needsLegalAcceptance(session.user.legalVersion)) {
    redirect(`${LEGAL_ACCEPT_PATH}?${RETURN_TO_PARAM}=${encodeURIComponent(returnTo)}`);
  }
  return session;
}

/**
 * Exige login E um perfil mínimo (ex.: "ADMIN").
 *
 * Se a pessoa estiver logada mas não tiver o perfil, respondemos "página não encontrada"
 * (404) em vez de "proibido": assim nem revelamos que a área existe.
 */
export async function requireRole(requiredRole: Role, returnTo: string) {
  const session = await requireSession(returnTo);
  if (!hasMinimumRole(session.user.role, requiredRole)) {
    notFound();
  }
  return session;
}
