/**
 * page.tsx — Tela de cadastro: /cadastro
 *
 * Quem chama: o Next.js, quando alguém acessa /cadastro.
 * Todo cadastro novo nasce com o perfil STUDENT (aluno).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { isGoogleAuthEnabled } from "@/modules/auth/auth";
import { SignUpForm } from "@/modules/auth/components/sign-up-form";
import { RETURN_TO_PARAM, safeRedirectPath } from "@/modules/auth/redirect";
import { getCurrentSession } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage({ searchParams }: PageProps<"/cadastro">) {
  const params = await searchParams;
  const redirectTo = safeRedirectPath(params[RETURN_TO_PARAM]);

  if (await getCurrentSession()) {
    redirect(redirectTo);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Criar conta</CardTitle>
        <CardDescription>Leva menos de um minuto.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm redirectTo={redirectTo} googleEnabled={isGoogleAuthEnabled} />
      </CardContent>
      <CardFooter className="text-muted-foreground flex-col gap-2 text-sm">
        <p>
          Já tem conta?{" "}
          <Link
            href={`/entrar?${RETURN_TO_PARAM}=${encodeURIComponent(redirectTo)}`}
            className="text-foreground font-medium hover:underline"
          >
            Entrar
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
