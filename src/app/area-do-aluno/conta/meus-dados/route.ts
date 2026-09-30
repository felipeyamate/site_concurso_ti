/**
 * route.ts — "Baixar meus dados": /area-do-aluno/conta/meus-dados  (exige login)
 *
 * Quem chama: o botão "Baixar meus dados" em "Minha conta e privacidade".
 * O que devolve: um arquivo JSON (download) com os dados da pessoa logada (`buildPersonalDataExport`).
 * Sem login → página de entrar (voltando para "Minha conta" depois).
 *
 * Funciona mesmo sem o aceite da versão atual dos termos (direito de acesso da LGPD).
 * Nunca guardado em cache: cada resposta é de uma pessoa.
 */
import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { loginPath } from "@/modules/auth/redirect";
import { getCurrentSession } from "@/modules/auth/session";
import { buildPersonalDataExport } from "@/modules/privacy/data-export.server";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.redirect(new URL(loginPath("/area-do-aluno/conta"), request.url), { headers: NO_STORE });
  }
  const now = new Date();
  const data = await buildPersonalDataExport(session.user.id, now);
  if (!data) return new NextResponse("Conta não encontrada.", { status: 404, headers: NO_STORE });

  const fileName = `meus-dados-concurso-ti-${now.toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
