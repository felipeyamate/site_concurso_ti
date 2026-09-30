/**
 * admin-users.server.ts — Usuários no painel (só ADMIN): busca, detalhes e troca de perfil.
 *
 * Quem chama: as páginas /admin/usuarios e a Server Action de troca de perfil (`admin-actions.ts`).
 * Os testes de integração chamam direto.
 */
import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isTransactionConflict } from "@/lib/db-errors";
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

/** Um usuário com as matrículas (e o curso de cada uma) e as compras (Fase 4, para o suporte). */
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
      deletedAt: true,
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
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, productTitle: true, priceCents: true, status: true, createdAt: true },
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, planTitle: true, priceCents: true, cycle: true, status: true, createdAt: true },
      },
      // Só logins ainda válidos ("dispositivos conectados"); sessões vencidas não contam.
      _count: { select: { sessions: { where: { expiresAt: { gt: new Date() } } } } },
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
 *
 * Por que "Serializable": com o nível padrão, dois admins rebaixando um ao outro AO MESMO TEMPO
 * contariam "1 outro admin" cada um, e os dois rebaixamentos passariam — o site ficaria sem admin.
 * No nível serializável o banco percebe o conflito e cancela uma das duas (a pessoa tenta de novo).
 */
export async function changeUserRole(params: { actorId: string; userId: string; role: Role }) {
  try {
    return await prisma.$transaction(
      async (tx) => {
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isTransactionConflict(error)) {
      throw new UserFacingError("Outra alteração de perfil aconteceu ao mesmo tempo. Confira a lista e tente de novo.");
    }
    throw error;
  }
}
