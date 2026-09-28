/**
 * page.tsx — Painel administrativo: /admin  (exige perfil TEACHER ou ADMIN)
 *
 * Quem chama: o Next.js. O `requireRole` confere login + perfil no banco;
 * quem não tem o perfil recebe "página não encontrada" (404).
 *
 * Fase 1: só a estrutura e a lista de usuários (visível apenas para ADMIN).
 * O cadastro de cursos, vídeos e PDFs entra na Fase 3.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { ROLE_LABELS, hasMinimumRole } from "@/modules/auth/roles";
import { requireRole } from "@/modules/auth/session";

export const metadata: Metadata = {
  title: "Painel admin",
  robots: { index: false },
};

const USERS_PAGE_SIZE = 50;

export default async function AdminPage() {
  const { user } = await requireRole("TEACHER", "/admin");
  const isAdmin = hasMinimumRole(user.role, "ADMIN");

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel admin</h1>
          <p className="text-muted-foreground text-sm">
            Conectado como {user.name} ({isAdmin ? "Administrador" : "Professor"})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/area-do-aluno">Área do aluno</Link>
          </Button>
          <SignOutButton />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cursos</CardTitle>
          <CardDescription>O cadastro de cursos, aulas, vídeos e PDFs chega na Fase 3.</CardDescription>
        </CardHeader>
      </Card>

      {isAdmin ? <LatestUsers /> : null}
    </div>
  );
}

/**
 * Tabela com os últimos cadastros (somente ADMIN chega a renderizar isto).
 * É um "Server Component" assíncrono: busca no banco direto, no servidor.
 */
async function LatestUsers() {
  const [users, totalUsers] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: USERS_PAGE_SIZE,
      select: { id: true, name: true, email: true, role: true, emailVerified: true, createdAt: true },
    }),
    prisma.user.count(),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuários</CardTitle>
        <CardDescription>
          {totalUsers} cadastrado(s). Mostrando os {Math.min(totalUsers, USERS_PAGE_SIZE)} mais recentes.
          Para mudar um perfil: <code>npm run user:set-role -- email PERFIL</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="py-2 pr-4 font-medium">Nome</th>
              <th className="py-2 pr-4 font-medium">E-mail</th>
              <th className="py-2 pr-4 font-medium">Perfil</th>
              <th className="py-2 pr-4 font-medium">E-mail confirmado</th>
              <th className="py-2 font-medium">Cadastro</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((item) => (
              <tr key={item.id}>
                <td className="py-2 pr-4">{item.name}</td>
                <td className="py-2 pr-4">{item.email}</td>
                <td className="py-2 pr-4">
                  <Badge variant={item.role === "STUDENT" ? "secondary" : "default"}>
                    {ROLE_LABELS[item.role]}
                  </Badge>
                </td>
                <td className="py-2 pr-4">{item.emailVerified ? "Sim" : "Não"}</td>
                <td className="py-2">{formatDateTime(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
