/**
 * page.tsx — Tela de nova senha: /redefinir-senha?token=...
 *
 * Quem chama: o link do e-mail de redefinição. O caminho completo é:
 *   e-mail → /api/auth/reset-password/<token> (Better Auth confere o token)
 *          → /redefinir-senha?token=<token>        (token válido)
 *          → /redefinir-senha?error=INVALID_TOKEN  (token vencido/usado)
 */
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/modules/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Criar nova senha" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/redefinir-senha">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  const hasError = typeof params.error === "string";

  if (!token || hasError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Link inválido ou vencido</CardTitle>
          <CardDescription>
            Links de redefinição valem por 1 hora e só podem ser usados uma vez. Peça um novo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/esqueci-senha">Pedir novo link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Criar nova senha</CardTitle>
        <CardDescription>Escolha uma senha com pelo menos 8 caracteres.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
      </CardContent>
    </Card>
  );
}
