/**
 * page.tsx — Área do aluno: /area-do-aluno  (exige login)
 *
 * Quem chama: o Next.js. Antes, o `proxy.ts` já barrou quem não tem cookie de login;
 * aqui o `requireSession` confere a sessão de verdade no banco.
 *
 * Mostra os dados da conta, avisos (e-mail não confirmado, conta sem senha), "Meus cursos"
 * com o progresso e o botão "Continuar", o atalho para "Minhas compras" (Fase 4), os atalhos do
 * banco de questões (Fase 5) e os dispositivos conectados (limite de sessões).
 */
import "server-only";

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
import { MyCourses } from "@/modules/progress/components/my-courses";
import { listMyCourseViews } from "@/modules/progress/course-view.server";
import { MAX_ACTIVE_SESSIONS } from "@/modules/auth/session-limit";
import { describeUserAgent } from "@/modules/auth/user-agent";

export const metadata: Metadata = {
  title: "Área do aluno",
  robots: { index: false }, // área privada: o Google não deve indexar
};

export default async function StudentAreaPage() {
  const { user, session } = await requireSession("/area-do-aluno");

  // Busca, em paralelo (como um `asyncio.gather`): os logins ativos do aluno (só campos de
  // exibição; nunca o token), se a conta tem senha cadastrada e os cursos com o progresso.
  const [activeSessions, passwordAccounts, myCourses, affiliate] = await Promise.all([
    prisma.session.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.account.count({ where: { userId: user.id, providerId: "credential" } }),
    listMyCourseViews({ userId: user.id, role: user.role }),
    // Fase 6: a pessoa é afiliada? (mostra o atalho para a área do afiliado)
    prisma.affiliate.findUnique({ where: { userId: user.id }, select: { id: true } }),
  ]);
  // Conta sem senha: quem só usa o link por e-mail ou o Google — ou quem teve a senha removida
  // pela proteção do Better Auth ao entrar pelo link mágico sem ter confirmado o e-mail.
  const hasPassword = passwordAccounts > 0;

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
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{roleLabel}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href="/area-do-aluno/compras">Minhas compras</Link>
          </Button>
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

      {hasPassword ? null : (
        <Alert>
          <AlertTitle>Sua conta não tem senha</AlertTitle>
          <AlertDescription>
            <p>
              Você entra pelo link enviado por e-mail (ou pelo Google). Se quiser também entrar com
              e-mail e senha, crie uma senha:
            </p>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/esqueci-senha">Criar uma senha</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <MyCourses courses={myCourses} />

      <Card>
        <CardHeader>
          <CardTitle>Treinar com questões</CardTitle>
          <CardDescription>Questões comentadas, simulados com tempo de prova e o seu desempenho por assunto.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/questoes">Resolver questões</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/simulados">Simulados</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/area-do-aluno/desempenho">Meu desempenho</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/o-que-mais-cai">O que mais cai</Link>
          </Button>
        </CardContent>
      </Card>

      {affiliate ? (
        <Card>
          <CardHeader>
            <CardTitle>Programa de afiliados</CardTitle>
            <CardDescription>Seu link de divulgação, as vendas indicadas e as suas comissões.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/area-do-aluno/afiliado">Abrir a área do afiliado</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
