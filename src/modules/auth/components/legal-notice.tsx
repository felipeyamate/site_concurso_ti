/**
 * legal-notice.tsx — Aviso "Ao continuar, você concorda com os Termos...".
 *
 * Quem chama: as telas de login e de cadastro.
 * (O registro formal do consentimento, exigido pela LGPD, está previsto para a Fase 7.)
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
