/**
 * layout.tsx — Moldura das páginas de assinatura (/assinar/...), que exigem login.
 *
 * Quem chama: o Next.js, envolvendo as páginas desta pasta.
 * O que faz: inclui o `SessionRefresher` (renova o login enquanto a pessoa preenche o checkout).
 * A checagem de login continua em cada página (`requireSession`).
 */
import { SessionRefresher } from "@/modules/auth/components/session-refresher";

export default function SubscribeLayout({ children }: LayoutProps<"/assinar">) {
  return (
    <>
      <SessionRefresher />
      {children}
    </>
  );
}
