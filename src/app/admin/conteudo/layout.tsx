/**
 * layout.tsx — Moldura da seção "Conteúdo do site" do painel (/admin/conteudo/...): o submenu.
 *
 * Quem chama: o Next.js, dentro da moldura do painel (`/admin/layout.tsx`, que já tem o
 * `SessionRefresher`). Cada página confere o perfil com `requireRole("TEACHER")`.
 */
import { ContentNav } from "@/components/admin/content-nav";

export default function ContentLayout({ children }: LayoutProps<"/admin/conteudo">) {
  return (
    <>
      <div className="mx-auto w-full max-w-5xl px-4 pt-6">
        <ContentNav />
      </div>
      {children}
    </>
  );
}
