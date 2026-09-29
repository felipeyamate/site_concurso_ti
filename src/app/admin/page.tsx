/**
 * page.tsx — Painel administrativo, visão geral: /admin  (exige perfil TEACHER ou ADMIN)
 *
 * Quem chama: o Next.js. O `requireRole` confere login + perfil no banco;
 * quem não tem o perfil recebe "página não encontrada" (404).
 *
 * Mostra: atalhos para cursos e usuários, e a situação das integrações (Panda Video e
 * armazenamento de PDFs) — só "configurado / não configurado", nunca os valores das chaves.
 */
import "server-only";

import { CircleAlert, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { ROLE_LABELS, hasMinimumRole } from "@/modules/auth/roles";
import { requireRole } from "@/modules/auth/session";
import { getStorageKind } from "@/modules/storage/storage.server";

export const metadata: Metadata = {
  title: "Painel admin",
  robots: { index: false },
};

export default async function AdminPage() {
  const { user } = await requireRole("TEACHER", "/admin");
  const isAdmin = hasMinimumRole(user.role, "ADMIN");

  const [courseCount, publishedCount, lessonCount, userCount] = await Promise.all([
    prisma.course.count(),
    prisma.course.count({ where: { isPublished: true } }),
    prisma.lesson.count(),
    isAdmin ? prisma.user.count() : Promise.resolve(0),
  ]);

  const isProduction = env.NODE_ENV === "production";
  const drmConfigured = Boolean(env.PANDA_DRM_GROUP_ID && env.PANDA_DRM_SECRET);
  const storageKind = getStorageKind();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-muted-foreground text-sm">
            Conectado como {user.name} ({isAdmin ? ROLE_LABELS.ADMIN : ROLE_LABELS.TEACHER})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/area-do-aluno">Área do aluno</Link>
          </Button>
          <SignOutButton />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cursos</CardTitle>
            <CardDescription>
              {courseCount} curso(s), {publishedCount} publicado(s) · {lessonCount} aula(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/cursos">Gerenciar cursos e aulas</Link>
            </Button>
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>{userCount} cadastrado(s). Perfis e matrículas.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/admin/usuarios">Gerenciar usuários</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integrações</CardTitle>
          <CardDescription>
            Configuradas pelas variáveis de ambiente (arquivo .env.local ou painel da Vercel). Passo a passo no README.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <IntegrationStatus
            ok={drmConfigured}
            title="Panda Video — marca d'água (DRM)"
            okText="Configurada: o nome, o e-mail e o ID do aluno aparecem dentro do vídeo."
            missingText={
              isProduction
                ? "NÃO configurada: as aulas do Panda não tocam em produção até configurar (PANDA_DRM_GROUP_ID e PANDA_DRM_SECRET)."
                : "Não configurada: em desenvolvimento o vídeo toca sem a marca d'água do Panda."
            }
          />
          <IntegrationStatus
            ok={Boolean(env.PANDA_API_KEY)}
            title="Panda Video — biblioteca"
            okText="Configurada: dá para escolher o vídeo da aula direto da sua biblioteca."
            missingText="Não configurada (PANDA_API_KEY): cole o link do player do Panda na aula."
          />
          <IntegrationStatus
            ok={storageKind !== null}
            title="PDFs das aulas"
            okText={
              storageKind === "R2"
                ? "Cloudflare R2 configurado."
                : "Pasta local (só desenvolvimento). Em produção, configure o Cloudflare R2."
            }
            missingText="Desligado: configure o Cloudflare R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationStatus(props: { ok: boolean; title: string; okText: string; missingText: string }): ReactNode {
  const Icon = props.ok ? CircleCheck : CircleAlert;
  return (
    <div className="flex items-start gap-3">
      <Icon className={props.ok ? "mt-0.5 size-5 shrink-0 text-green-600" : "mt-0.5 size-5 shrink-0 text-amber-600"} />
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{props.title}</span>
        <span className="text-muted-foreground text-sm">{props.ok ? props.okText : props.missingText}</span>
      </div>
    </div>
  );
}
