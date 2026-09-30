/**
 * page.tsx — /admin/conteudo: leva direto para o blog (a primeira seção de conteúdo).
 *
 * Quem chama: o menu do painel ("Conteúdo do site").
 */
import "server-only";

import { redirect } from "next/navigation";

import { requireRole } from "@/modules/auth/session";

export default async function ContentIndexPage() {
  await requireRole("TEACHER", "/admin/conteudo");
  redirect("/admin/conteudo/blog");
}
