"use client";

/**
 * admin-nav.tsx — Menu do painel admin (Visão geral, Cursos, Questões, Conteúdo do site, Usuários, Vendas).
 *
 * Quem chama: `src/app/admin/layout.tsx`.
 * "use client" porque destaca a página atual (`usePathname` lê o endereço no navegador).
 * O menu só ESCONDE links; quem protege de verdade é o `requireRole` de cada página.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type AdminNavProps = { isAdmin: boolean };

export function AdminNav({ isAdmin }: AdminNavProps) {
  const pathname = usePathname();
  const links = [
    { href: "/admin", label: "Visão geral", exact: true },
    { href: "/admin/cursos", label: "Cursos", exact: false },
    { href: "/admin/questoes", label: "Questões", exact: false },
    { href: "/admin/conteudo", label: "Conteúdo do site", exact: false },
    ...(isAdmin
      ? [
          { href: "/admin/usuarios", label: "Usuários", exact: false },
          { href: "/admin/vendas", label: "Vendas", exact: false },
        ]
      : []),
  ];

  return (
    <nav aria-label="Menu do painel" className="flex flex-wrap gap-1">
      {links.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
