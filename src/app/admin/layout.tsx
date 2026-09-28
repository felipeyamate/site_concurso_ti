/**
 * layout.tsx — Moldura de todas as páginas do painel admin (/admin/...).
 *
 * Quem chama: o Next.js, envolvendo as páginas desta pasta.
 * O que faz: inclui o `SessionRefresher`, que renova o login enquanto a pessoa usa o painel.
 * (A checagem de acesso continua em cada página, com `requireRole`.)
 */
import { SessionRefresher } from "@/modules/auth/components/session-refresher";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <SessionRefresher />
      {children}
    </>
  );
}
