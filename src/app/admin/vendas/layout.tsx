/**
 * layout.tsx — Moldura da seção Vendas do painel (/admin/vendas/...): o submenu.
 *
 * Quem chama: o Next.js, dentro da moldura do painel (`/admin/layout.tsx`, que já tem o
 * `SessionRefresher`). O submenu só aparece para ADMIN; cada página confere com `requireRole`.
 */
import { SalesNav } from "@/modules/payments/admin/components/sales-nav";
import { hasMinimumRole } from "@/modules/auth/roles";
import { getCurrentSession } from "@/modules/auth/session";

export default async function SalesLayout({ children }: LayoutProps<"/admin/vendas">) {
  const session = await getCurrentSession();
  const isAdmin = hasMinimumRole(session?.user.role, "ADMIN");

  return (
    <>
      {isAdmin ? (
        <div className="mx-auto w-full max-w-5xl px-4 pt-6">
          <SalesNav />
        </div>
      ) : null}
      {children}
    </>
  );
}
