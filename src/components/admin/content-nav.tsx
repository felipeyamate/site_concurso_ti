"use client";

/**
 * content-nav.tsx — Submenu da seção "Conteúdo do site" do painel (Blog, Concursos).
 *
 * Quem chama: `src/app/admin/conteudo/layout.tsx`.
 * "use client" porque destaca a página atual (`usePathname`). O menu só ESCONDE links; quem protege
 * de verdade é o `requireRole("TEACHER")` de cada página.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/conteudo/blog", label: "Blog" },
  { href: "/admin/conteudo/concursos", label: "Concursos (páginas de edital)" },
];

export function ContentNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu de conteúdo" className="flex flex-wrap gap-1">
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              active ? "border-primary bg-primary/10" : "hover:bg-muted text-muted-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
