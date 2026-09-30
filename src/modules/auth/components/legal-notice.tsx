/**
 * legal-notice.tsx — Aviso "Ao continuar, você concorda com os Termos...".
 *
 * Quem chama: a tela de login. (No cadastro, o aceite é uma caixa a marcar e fica registrado — Fase 7;
 * quem entra pelo Google ou pelo link mágico sem ter aceitado passa pela tela /aceitar-termos.)
 */
import Link from "next/link";

export function LegalNotice({ action }: { action: string }) {
  return (
    <p className="text-center text-xs">
      {action}, você concorda com os{" "}
      <Link href="/termos" className="underline">
        Termos de uso
      </Link>{" "}
      e a{" "}
      <Link href="/privacidade" className="underline">
        Política de privacidade
      </Link>
      .
    </p>
  );
}
