/**
 * layout.tsx — Moldura das páginas de compra (/comprar/...), que exigem login.
 *
 * Quem chama: o Next.js, envolvendo as páginas desta pasta.
 * O que faz: inclui o `SessionRefresher` (renova o login enquanto a pessoa preenche o checkout).
 * A checagem de login continua em cada página (`requireSession`).
 */
import { SessionRefresher } from "@/modules/auth/components/session-refresher";

export default function CheckoutLayout({ children }: LayoutProps<"/comprar">) {
  return (
    <>
      <SessionRefresher />
      {children}
    </>
  );
}
