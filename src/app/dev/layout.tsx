/**
 * layout.tsx — Moldura das páginas de DESENVOLVIMENTO (/dev/...), como a simulação de pagamentos.
 *
 * Quem chama: o Next.js, envolvendo as páginas desta pasta.
 * O que faz: inclui o `SessionRefresher` (são páginas que exigem login). Cada página confere o
 * login e responde "não encontrada" em produção.
 */
import { SessionRefresher } from "@/modules/auth/components/session-refresher";

export default function DevLayout({ children }: LayoutProps<"/dev">) {
  return (
    <>
      <SessionRefresher />
      {children}
    </>
  );
}
