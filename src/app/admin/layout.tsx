/**
 * layout.tsx — Moldura de todas as páginas do painel admin (/admin/...).
 *
 * Quem chama: o Next.js, envolvendo as páginas desta pasta.
 * O que faz:
 *  - inclui o `SessionRefresher`, que renova o login enquanto a pessoa usa o painel;
 *  - mostra o menu do painel (só para professor/admin).
 * A checagem de acesso continua em CADA página, com `requireRole` (a moldura não protege nada).
 */
import { AdminNav } from "@/components/admin/admin-nav";
import { SessionRefresher } from "@/modules/auth/components/session-refresher";
import { hasMinimumRole } from "@/modules/auth/roles";
import { getCurrentSession } from "@/modules/auth/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await getCurrentSession();
  const isStaff = hasMinimumRole(session?.user.role, "TEACHER");

  return (
    <>
      <SessionRefresher />
      {isStaff ? (
        <div className="border-b">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="text-sm font-semibold">Painel admin</span>
            <AdminNav isAdmin={hasMinimumRole(session?.user.role, "ADMIN")} />
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
