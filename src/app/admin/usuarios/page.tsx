/**
 * page.tsx — Usuários no painel: /admin/usuarios?busca=...&pagina=...  (exige perfil ADMIN)
 *
 * Quem chama: o Next.js (menu "Usuários" do painel). Professor recebe 404.
 * Mostra a lista de cadastros (mais recentes primeiro), com busca por nome ou e-mail e páginas
 * de 25. "Gerenciar" abre o usuário (perfil e matrículas).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { listUsersForAdmin } from "@/modules/auth/admin-users.server";
import { ROLE_LABELS } from "@/modules/auth/roles";
import { requireRole } from "@/modules/auth/session";

export const metadata: Metadata = {
  title: "Usuários · Painel admin",
  robots: { index: false },
};

// Os parâmetros da URL podem vir repetidos (?busca=a&busca=b); usamos só o primeiro.
function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  await requireRole("ADMIN", "/admin/usuarios");
  const params = await searchParams;
  const search = firstValue(params.busca).slice(0, 100);
  const requestedPage = Number.parseInt(firstValue(params.pagina), 10);
  const { users, total, page, pageCount } = await listUsersForAdmin({
    search,
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
  });

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("busca", search);
    query.set("pagina", String(target));
    return `/admin/usuarios?${query.toString()}`;
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-muted-foreground text-sm">
          {total} {search ? `encontrado(s) para "${search}"` : "cadastrado(s)"}. Abra um usuário para mudar o perfil ou
          matricular em cursos.
        </p>
      </div>

      {/* Formulário comum (GET): a busca vira parte do endereço, e dá para voltar/compartilhar. */}
      <form action="/admin/usuarios" className="flex flex-wrap gap-2" role="search">
        <Input
          name="busca"
          defaultValue={search}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar por nome ou e-mail"
          className="min-w-0 flex-1 sm:max-w-sm"
        />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
        {search ? (
          <Button asChild variant="ghost">
            <Link href="/admin/usuarios">Limpar</Link>
          </Button>
        ) : null}
      </form>

      {/* `relative`: o texto "sr-only" (invisível) do cabeçalho fica preso aqui dentro, sem alargar a página. */}
      <div className="relative overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="p-3 font-medium">Nome</th>
              <th className="p-3 font-medium">E-mail</th>
              <th className="p-3 font-medium">Perfil</th>
              <th className="p-3 font-medium">Cadastro</th>
              <th className="p-3 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((item) => (
              <tr key={item.id}>
                <td className="p-3">{item.name}</td>
                <td className="p-3">
                  {item.email}
                  {!item.emailVerified ? <span className="text-muted-foreground text-xs"> (não confirmado)</span> : null}
                </td>
                <td className="p-3">
                  <Badge variant={item.role === "STUDENT" ? "secondary" : "default"}>{ROLE_LABELS[item.role]}</Badge>
                </td>
                <td className="p-3 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                <td className="p-3 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/usuarios/${item.id}`}>Gerenciar</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground p-3">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Páginas">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page - 1)}>Anterior</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Página {page} de {pageCount}
          </span>
          {page < pageCount ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page + 1)}>Próxima</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
