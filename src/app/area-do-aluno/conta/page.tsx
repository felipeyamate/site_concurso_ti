/**
 * page.tsx — Minha conta e privacidade: /area-do-aluno/conta  (exige login)
 *
 * Quem chama: o Next.js (atalho na área do aluno e na tela de aceite dos termos).
 * Mostra os direitos da LGPD (art. 18) num lugar só: corrigir o nome, ver os aceites dos termos,
 * baixar os dados (arquivo JSON) e excluir a conta — com o que impede excluir agora, se houver.
 *
 * Abre mesmo para quem ainda não aceitou a versão atual dos termos (`allowPendingLegal`): quem não
 * concorda com os textos novos precisa conseguir levar os dados e sair.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { loginPath } from "@/modules/auth/redirect";
import { requireSession } from "@/modules/auth/session";
import { getCompanyInfo } from "@/modules/legal/company.server";
import { LEGAL_VERSION, LEGAL_VERSION_LABEL } from "@/modules/legal/version";
import { findDeletionBlockers } from "@/modules/privacy/account-deletion.server";
import { DeleteAccountForm, NameForm } from "@/modules/privacy/components/privacy-forms";
import { listLegalConsents } from "@/modules/privacy/consent.server";
import { FRESH_LOGIN_MINUTES, isFreshLogin } from "@/modules/privacy/rules";

export const metadata: Metadata = { title: "Minha conta e privacidade", robots: { index: false } };

export default async function AccountPrivacyPage() {
  const { user, session } = await requireSession("/area-do-aluno/conta", { allowPendingLegal: true });
  const [consents, blockers] = await Promise.all([listLegalConsents(user.id), findDeletionBlockers(prisma, user.id)]);
  const freshLogin = isFreshLogin(new Date(session.createdAt), new Date());
  const company = getCompanyInfo();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <Link href="/area-do-aluno" className="text-muted-foreground text-sm hover:underline">
          ← Área do aluno
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Minha conta e privacidade</h1>
        <p className="text-muted-foreground text-sm">
          Seus direitos pela LGPD: corrigir, baixar e excluir os seus dados. Outros pedidos:{" "}
          <a href={`mailto:${company.contactEmail}`} className="underline">
            {company.contactEmail}
          </a>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seus dados</CardTitle>
          <CardDescription>
            {/* break-all: um e-mail comprido não tem onde quebrar e alargaria a página no celular. */}
            E-mail: <span className="break-all">{user.email}</span> (para trocar o e-mail, fale com o suporte).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NameForm name={user.name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Termos de uso e Política de privacidade</CardTitle>
          <CardDescription>
            Versão atual: {LEGAL_VERSION_LABEL}.{" "}
            {user.legalVersion === LEGAL_VERSION ? "Você já aceitou esta versão." : "Você ainda não aceitou esta versão."}{" "}
            <Link href="/termos" className="underline">
              Termos de uso
            </Link>{" "}
            ·{" "}
            <Link href="/privacidade" className="underline">
              Política de privacidade
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {consents.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum aceite registrado ainda.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {consents.map((consent) => (
                <li key={consent.id}>
                  Aceite da versão {consent.version} em {formatDateTime(consent.acceptedAt)} ({consent.source === "SIGN_UP" ? "no cadastro" : "na tela de aceite"})
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Baixar meus dados</CardTitle>
          <CardDescription>
            Um arquivo (JSON) com tudo o que guardamos sobre você: conta, aceites, matrículas, progresso, respostas, compras e
            pagamentos. Abre em qualquer editor de texto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            {/* Link comum (não o do Next): é um download, não uma página. */}
            <a href="/area-do-aluno/conta/meus-dados" download>
              Baixar meus dados
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Excluir minha conta</CardTitle>
          <CardDescription>
            Apagamos seus dados de acesso e de estudo (logins, progresso, respostas e simulados) e o seu nome e e-mail. Compras e
            pagamentos ficam guardados, sem o seu nome, pelo prazo da lei fiscal. Não dá para desfazer.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {blockers.length > 0 ? (
            <Alert>
              <AlertTitle>Ainda não dá para excluir</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          {blockers.length === 0 && !freshLogin ? (
            <Alert>
              <AlertTitle>Entre de novo para confirmar</AlertTitle>
              <AlertDescription>
                <p>Por segurança, só exclui a conta quem entrou nos últimos {FRESH_LOGIN_MINUTES} minutos. Saia, entre de novo e volte aqui.</p>
                <SignOutButton afterSignOut={loginPath("/area-do-aluno/conta")} />
              </AlertDescription>
            </Alert>
          ) : null}
          <DeleteAccountForm disabled={blockers.length > 0 || !freshLogin} />
        </CardContent>
      </Card>
    </div>
  );
}
