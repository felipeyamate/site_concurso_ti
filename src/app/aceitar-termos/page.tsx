/**
 * page.tsx — Tela de aceite dos Termos de uso e da Política de privacidade: /aceitar-termos
 *
 * Quem chama: a checagem de login (`requireSession`), que manda para cá quem ainda não aceitou a
 * versão ATUAL dos textos — quem entrou pelo Google/link mágico (sem o formulário de cadastro) ou
 * quando os textos mudaram. Depois do aceite, volta para a página que a pessoa queria (`?voltar=`).
 *
 * Quem não concorda tem saída: baixar os dados e excluir a conta ("Minha conta e privacidade" abre
 * mesmo sem o aceite) ou simplesmente sair.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { DEFAULT_AFTER_LOGIN_PATH, RETURN_TO_PARAM, safeRedirectPath } from "@/modules/auth/redirect";
import { requireSession } from "@/modules/auth/session";
import { LEGAL_ACCEPT_PATH, LEGAL_VERSION_LABEL, needsLegalAcceptance } from "@/modules/legal/version";
import { AcceptTermsForm } from "@/modules/privacy/components/privacy-forms";

export const metadata: Metadata = { title: "Termos de uso e privacidade", robots: { index: false } };

export default async function AcceptTermsPage({ searchParams }: PageProps<"/aceitar-termos">) {
  const returnTo = safeRedirectPath((await searchParams)[RETURN_TO_PARAM], DEFAULT_AFTER_LOGIN_PATH);
  // Voltar para a própria tela de aceite criaria um vaivém: nesse caso, vai para a área do aluno.
  const destination = returnTo.startsWith(LEGAL_ACCEPT_PATH) ? DEFAULT_AFTER_LOGIN_PATH : returnTo;
  const { user } = await requireSession(`${LEGAL_ACCEPT_PATH}?${RETURN_TO_PARAM}=${encodeURIComponent(destination)}`, {
    allowPendingLegal: true,
  });
  // Já aceitou esta versão (ex.: abriu a tela em duas abas): segue direto.
  if (!needsLegalAcceptance(user.legalVersion)) redirect(destination);

  return (
    <div className="mx-auto grid w-full max-w-xl gap-6 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Antes de continuar</CardTitle>
          <CardDescription>
            {user.legalVersion
              ? `Atualizamos os Termos de uso e a Política de privacidade (versão de ${LEGAL_VERSION_LABEL}).`
              : `Para usar a sua conta, leia e aceite os Termos de uso e a Política de privacidade (versão de ${LEGAL_VERSION_LABEL}).`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <p className="text-sm leading-relaxed">
            Os textos explicam as regras do site (acesso, compras e reembolso) e como tratamos os seus dados: o que coletamos,
            para quê, com quem compartilhamos e como pedir a exclusão.
          </p>
          <AcceptTermsForm returnTo={destination} />
          <div className="text-muted-foreground grid gap-2 border-t pt-4 text-sm">
            <p>
              Não concorda? Você pode{" "}
              <Link href="/area-do-aluno/conta" className="underline">
                baixar os seus dados ou excluir a sua conta
              </Link>
              , ou sair.
            </p>
            <div>
              <SignOutButton />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
