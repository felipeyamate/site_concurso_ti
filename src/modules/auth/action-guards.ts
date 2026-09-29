/**
 * action-guards.ts — "Quem pode chamar esta ação?" para as Server Actions do painel admin.
 *
 * Quem chama: as Server Actions de `/admin` (catálogo, materiais, usuários, matrículas).
 * O que devolve: a sessão, se a pessoa está logada e tem o perfil mínimo; senão `null`.
 *
 * Por que existe além do `requireRole` das páginas: uma Server Action é uma requisição HTTP
 * que qualquer pessoa pode disparar direto, sem passar pela página. Então TODA ação confere
 * login + perfil de novo (no banco), antes de validar os dados e gravar.
 * Paralelo em Python/Django: é o `@permission_required` aplicado em cada view que grava dados.
 */
import "server-only";

import { hasMinimumRole, type Role } from "./roles";
import { getCurrentSession } from "./session";

export async function getSessionWithRole(minimumRole: Role) {
  const session = await getCurrentSession();
  if (!session || !hasMinimumRole(session.user.role, minimumRole)) {
    return null;
  }
  return session;
}

export const PERMISSION_DENIED_MESSAGE = "Você não tem permissão para isso. Entre novamente com uma conta autorizada.";
