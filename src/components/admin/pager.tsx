/**
 * pager.tsx — "Anterior · Página X de Y · Próxima" das listas do painel.
 *
 * Quem chama: as listas longas do painel (pedidos, assinaturas, avisos).
 * `hrefFor(página)` monta o endereço de cada página (mantendo os filtros da lista).
 */
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function Pager({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (page: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Páginas">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefFor(page - 1)}>Anterior</Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">
        Página {page} de {pageCount}
      </span>
      {page < pageCount ? (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefFor(page + 1)}>Próxima</Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Os parâmetros da URL podem vir repetidos (?busca=a&busca=b); usamos só o primeiro. */
export function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Número da página pedido na URL (1 se vier vazio ou inválido). */
export function pageParam(value: string | string[] | undefined): number {
  const page = Number.parseInt(firstParam(value), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}
