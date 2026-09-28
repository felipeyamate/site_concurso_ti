/**
 * page.tsx — Tela "Esqueci minha senha": /esqueci-senha
 *
 * Quem chama: o link "Esqueci minha senha" da tela de login.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/modules/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Esqueci minha senha</CardTitle>
        <CardDescription>Informe seu e-mail e enviaremos um link para criar uma nova senha.</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
      <CardFooter className="text-muted-foreground text-sm">
        <Link href="/entrar" className="hover:underline">
          Voltar para o login
        </Link>
      </CardFooter>
    </Card>
  );
}
