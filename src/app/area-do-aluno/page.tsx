/**
 * page.tsx — Área do aluno: /area-do-aluno  (exige login)
 *
 * Quem chama: o Next.js. Antes, o `proxy.ts` já barrou quem não tem cookie de login;
 * aqui o `requireSession` confere a sessão de verdade no banco.
 *
 * Fase 1: mostra os dados da conta, o aviso de e-mail não confirmado e os dispositivos
 * conectados (limite de sessões). Os cursos entram na Fase 2.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { ResendVerificationButton } from "@/modules/auth/components/resend-verification-button";
import { SessionList, type SessionListItem } from "@/modules/auth/components/session-list";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { ROLE_LABELS, hasMinimumRole, isRole } from "@/modules/auth/roles";
import { requireSession } from "@/modules/auth/session";
import { MAX_ACTIVE_SESSIONS } from "@/modules/auth/session-limit";
import { describeUserAgent } from "@/modules/auth/user-agent";

export const metadata: Metadata = {
  title: "Área do aluno",
  robots: { index: false }, // área privada: o Google não deve indexar
};

export default async function StudentAreaPage() {
  const { user, session } = await requireSession("/area-do-aluno");

  // Busca os logins ativos do aluno (só campos de exibição; nunca o token).
  const activeSessions = await prisma.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const sessionItems: SessionListItem[] = activeSessions.map((item) => ({
    id: item.id,
    deviceLabel: describeUserAgent(item.userAgent),
    signedInAt: formatDateTime(item.createdAt),
    isCurrent: item.id === session.id,
  }));

  const roleLabel = isRole(user.role) ? ROLE_LABELS[user.role] : user.role;
  const canSeeAdmin = hasMinimumRole(user.role, "TEACHER");

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {user.name}!</h1>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{roleLabel}</Badge>
          {canSeeAdmin ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">Painel admin</Link>
            </Button>
          ) : null}
          <SignOutButton />
        </div>
      </div>

      {user.emailVerified ? null : (
        <Alert>
          <AlertTitle>Confirme seu e-mail</AlertTitle>
          <AlertDescription>
            <p>
              Enviamos um link de confirmação para {user.email}. Confirmar garante que você
              receba avisos de compra e consiga recuperar a senha.
            </p>
            <ResendVerificationButton email={user.email} />
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Meus cursos</CardTitle>
          <CardDescription>Seus cursos vão aparecer aqui.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Em breve: o Curso Base &quot;Informática e TI para Concursos — do zero&quot;.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dispositivos conectados</CardTitle>
          <CardDescription>
            Sua conta pode ficar conectada em até {MAX_ACTIVE_SESSIONS} dispositivos ao mesmo tempo.
            Ao entrar em um novo, o acesso mais antigo é encerrado automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionList sessions={sessionItems} />
        </CardContent>
      </Card>
    </div>
  );
}
