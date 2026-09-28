/**
 * site-footer.tsx — Rodapé do site (links legais).
 *
 * Quem chama: `src/app/layout.tsx`, em todas as páginas.
 */
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm">
        <span>© {new Date().getFullYear()} Concurso TI</span>
        <nav className="flex gap-4">
          <Link href="/termos" className="hover:underline">
            Termos de uso
          </Link>
          <Link href="/privacidade" className="hover:underline">
            Política de privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
}
