/**
 * page.tsx — Tela de login: /entrar
 *
 * Quem chama: o Next.js, quando alguém acessa /entrar (ou é redirecionado para cá pelo
 * `proxy.ts` ao tentar abrir uma área protegida).
 *
 * Parâmetros opcionais na URL:
 *   ?voltar=/caminho   → para onde ir depois do login (validado contra "open redirect");
 *   ?error=CODIGO      → erro vindo de um link mágico vencido ou do login com Google.
 *
 * Esta página roda no SERVIDOR: decide se o Google está ligado e se a pessoa já está logada.
 * O formulário em si (`SignInForm`) roda no navegador.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { isGoogleAuthEnabled } from "@/modules/auth/auth";
import { LegalNotice } from "@/modules/auth/components/legal-notice";
import { SignInForm } from "@/modules/auth/components/sign-in-form";
import { getAuthErrorMessage } from "@/modules/auth/error-messages";
import { RETURN_TO_PARAM, safeRedirectPath } from "@/modules/auth/redirect";
import { getCurrentSession } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  // No Next.js 16, `searchParams` é uma Promise: precisamos do `await`.
  const params = await searchParams;
  const redirectTo = safeRedirectPath(params[RETURN_TO_PARAM]);

  // Já está logado? Não faz sentido mostrar o login de novo.
  if (await getCurrentSession()) {
    redirect(redirectTo);
  }

  const errorCode = typeof params.error === "string" ? params.error : null;
  const initialError = errorCode ? getAuthErrorMessage({ code: errorCode.toUpperCase() }) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
        <CardDescription>Acesse sua área do aluno.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm
          redirectTo={redirectTo}
          googleEnabled={isGoogleAuthEnabled}
          initialError={initialError}
        />
      </CardContent>
      <CardFooter className="text-muted-foreground flex-col gap-2 text-sm">
        <p>
          Ainda não tem conta?{" "}
          <Link
            href={`/cadastro?${RETURN_TO_PARAM}=${encodeURIComponent(redirectTo)}`}
            className="text-foreground font-medium hover:underline"
          >
            Criar conta
          </Link>
        </p>
        <LegalNotice action="Ao continuar" />
      </CardFooter>
    </Card>
  );
}
