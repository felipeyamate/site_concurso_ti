/**
 * layout.tsx — Moldura dos simulados (/simulados/...), que exigem login.
 *
 * Quem chama: o Next.js, envolvendo as páginas desta pasta.
 * O que faz: inclui o `SessionRefresher` (um simulado pode durar horas). A checagem de login
 * continua em cada página (`requireSession`).
 */
import { SessionRefresher } from "@/modules/auth/components/session-refresher";

export default function MockExamsLayout({ children }: LayoutProps<"/simulados">) {
  return (
    <>
      <SessionRefresher />
      {children}
    </>
  );
}
