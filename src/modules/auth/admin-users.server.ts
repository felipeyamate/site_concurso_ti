/**
 * admin-users.server.ts — Usuários no painel (só ADMIN): busca, detalhes e troca de perfil.
 *
 * Quem chama: as páginas /admin/usuarios e a Server Action de troca de perfil (`admin-actions.ts`).
 * Os testes de integração chamam direto.
 */
import "server-only";

import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";

import { checkRoleChange } from "./role-rules";
import { isRole, type Role } from "./roles";

export const USERS_PAGE_SIZE = 25;

/**
 * Lista usuários, dos mais recentes para os mais antigos, com busca por nome ou e-mail.
 * `contains` + `insensitive` = "contém, sem diferenciar maiúsculas" (como um ILIKE '%texto%').
 */
export async function listUsersForAdmin(params: { search: string; page: number }) {
  const search = params.search.trim();
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const page = Math.max(1, params.page);
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: { id: true, name: true, email: true, role: true, emailVerified: true, createdAt: true },
    }),
    prisma.user.count({ where }),
  ]);
  return { users, total, page, pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)) };
}

/** Um usuário com as matrículas (e o curso de cada uma). */
export async function getUserForAdmin(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      enrollments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          courseId: true,
          source: true,
          startsAt: true,
          expiresAt: true,
          revokedAt: true,
          course: { select: { title: true, slug: true } },
        },
      },
      _count: { select: { sessions: true } },
    },
  });
}

/** Cursos para a lista "Matricular em..." (inclusive rascunhos: a equipe pode liberar antes). */
export async function listCoursesForEnrollment() {
  return prisma.course.findMany({
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: { id: true, title: true, isPublished: true },
  });
}

/**
 * Troca o perfil de um usuário.
 * Passos (numa transação, para a contagem de administradores não mudar no meio):
 *  1. acha a pessoa; 2. conta os OUTROS administradores; 3. aplica as travas de `role-rules.ts`;
 *  4. grava. O novo perfil vale na próxima página que a pessoa abrir (o perfil é lido do banco).
 */
export async function changeUserRole(params: { actorId: string; userId: string; role: Role }) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: params.userId }, select: { id: true, role: true } });
    if (!target || !isRole(target.role)) throw new UserFacingError("Usuário não encontrado.");

    const otherAdminCount = await tx.user.count({ where: { role: "ADMIN", id: { not: target.id } } });
    const problem = checkRoleChange({
      actorId: params.actorId,
      targetId: target.id,
      currentRole: target.role,
      newRole: params.role,
      otherAdminCount,
    });
    if (problem) throw new UserFacingError(problem, { field: "role" });

    return tx.user.update({ where: { id: target.id }, data: { role: params.role } });
  });
}
