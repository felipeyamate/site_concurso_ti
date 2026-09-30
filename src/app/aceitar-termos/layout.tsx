/**
 * layout.tsx — Moldura da tela de aceite dos termos (/aceitar-termos), que exige login.
 *
 * Quem chama: o Next.js, envolvendo a página desta pasta.
 * O que faz: inclui o `SessionRefresher` (regra do CLAUDE.md para toda área logada).
 */
import { SessionRefresher } from "@/modules/auth/components/session-refresher";

export default function AcceptTermsLayout({ children }: LayoutProps<"/aceitar-termos">) {
  return (
    <>
      <SessionRefresher />
      {children}
    </>
  );
}
