/**
 * questions-subnav.tsx — Os atalhos da seção "Questões" do painel.
 *
 * Quem chama: as páginas /admin/questoes/...
 */
import Link from "next/link";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/questoes", label: "Questões", key: "list" },
  { href: "/admin/questoes/nova", label: "Nova questão", key: "new" },
  { href: "/admin/questoes/classificacao", label: "Bancas, assuntos e provas", key: "classification" },
  { href: "/admin/questoes/importar", label: "Importar planilha", key: "import" },
] as const;

export function QuestionsSubnav({ current }: { current: (typeof LINKS)[number]["key"] | null }) {
  return (
    <nav aria-label="Seção de questões" className="flex flex-wrap gap-2 text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          aria-current={current === link.key ? "page" : undefined}
          className={cn("rounded-md border px-3 py-1", current === link.key ? "bg-muted font-medium" : "hover:bg-muted")}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
