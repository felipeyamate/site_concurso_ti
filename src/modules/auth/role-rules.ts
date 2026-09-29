/**
 * role-rules.ts — Regras para MUDAR o perfil de alguém pelo painel (só ADMIN).
 *
 * Quem chama: `admin-users.server.ts`, antes de gravar o novo perfil.
 * Arquivo "puro", testado em `role-rules.test.ts`.
 *
 * Por que as travas: evitar que o site fique sem administrador (ninguém mais conseguiria
 * entrar no painel de usuários) e que alguém tire o próprio acesso sem querer.
 */
import type { Role } from "./roles";

export function checkRoleChange(params: {
  actorId: string;
  targetId: string;
  currentRole: Role;
  newRole: Role;
  // Quantos OUTROS administradores existem (sem contar a pessoa que está sendo alterada).
  otherAdminCount: number;
}): string | null {
  if (params.actorId === params.targetId) {
    return "Você não pode mudar o seu próprio perfil. Peça a outro administrador.";
  }
  if (params.currentRole === "ADMIN" && params.newRole !== "ADMIN" && params.otherAdminCount === 0) {
    return "Esta é a única conta de administrador. Promova outra pessoa antes.";
  }
  return null;
}
