/**
 * proxy.ts — Primeira barreira das áreas protegidas (roda antes de cada página listada abaixo).
 *
 * Quem chama: o próprio Next.js, automaticamente, para os caminhos do `matcher`.
 * (No Next.js 16 este arquivo substitui o antigo `middleware.ts`.)
 *
 * O que faz: se a pessoa tenta abrir /area-do-aluno, /admin ou uma aula SEM o cookie de login,
 * manda direto para /entrar?voltar=<página pedida>.
 *
 * Importante: aqui só verificamos se o cookie EXISTE (rápido, sem consultar o banco).
 * Um cookie vencido ou falso passa por aqui — por isso cada página protegida TAMBÉM
 * chama `requireSession`/`requireRole` (src/modules/auth/session.ts), que confere no banco.
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { RETURN_TO_PARAM } from "@/modules/auth/redirect";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL("/entrar", request.url);
    loginUrl.searchParams.set(RETURN_TO_PARAM, request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Caminhos protegidos. `:path*` inclui todas as subpáginas (ex.: /admin/usuarios).
  // As aulas (/cursos/<curso>/aulas/<aula>) exigem login; a página do curso é pública.
  matcher: ["/area-do-aluno/:path*", "/admin/:path*", "/cursos/:courseSlug/aulas/:path*"],
};
