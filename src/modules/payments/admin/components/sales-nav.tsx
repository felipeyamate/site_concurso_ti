"use client";

/**
 * sales-nav.tsx — Submenu da seção Vendas do painel (Resumo, Produtos, Planos, Pedidos, Cupons, Afiliados...).
 *
 * Quem chama: `src/app/admin/vendas/layout.tsx` (só para ADMIN).
 * "use client" porque destaca a página atual (`usePathname`). O menu só ESCONDE links; quem protege
 * de verdade é o `requireRole("ADMIN")` de cada página.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/vendas", label: "Resumo", exact: true },
  { href: "/admin/vendas/produtos", label: "Produtos", exact: false },
  { href: "/admin/vendas/planos", label: "Planos", exact: false },
  { href: "/admin/vendas/pedidos", label: "Pedidos", exact: false },
  { href: "/admin/vendas/assinaturas", label: "Assinaturas", exact: false },
  { href: "/admin/vendas/cupons", label: "Cupons", exact: false },
  { href: "/admin/vendas/afiliados", label: "Afiliados", exact: false },
  { href: "/admin/vendas/avisos", label: "Avisos do provedor", exact: false },
];

export function SalesNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu de vendas" className="flex flex-wrap gap-1">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
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
