/**
 * route.ts — Link de divulgação de um afiliado: /r/<codigo>  (ex.: /r/joao?para=/cursos/base)
 *
 * Quem chama: qualquer pessoa que clicar no link compartilhado pelo afiliado.
 * O que faz:
 *  1. Confere o destino (`?para=`): só caminhos DO NOSSO SITE (`safeRedirectPath`) — senão o link
 *     viraria um "redirecionador" para sites de golpe. Sem destino (ou inválido): página inicial.
 *  2. Se o código for de um afiliado ATIVO: soma 1 clique no dia e guarda o código num cookie por
 *     30 dias (vale o último link clicado). Na compra, o checkout lê esse cookie.
 *  3. Redireciona para o destino. Código inexistente ou desativado: só redireciona (sem cookie).
 *
 * O cookie é `httpOnly` (o JavaScript da página não lê) e `sameSite=lax` (vai junto quando a
 * pessoa navega pelo site). Ele não dá acesso a nada: só diz "quem indicou".
 */
import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { findAffiliateByCode, recordAffiliateClick } from "@/modules/affiliates/affiliates.server";
import {
  AFFILIATE_COOKIE,
  AFFILIATE_COOKIE_DAYS,
  AFFILIATE_TARGET_PARAM,
  isValidAffiliateCode,
  normalizeAffiliateCode,
} from "@/modules/affiliates/rules";
import { safeRedirectPath } from "@/modules/auth/redirect";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest, context: RouteContext<"/r/[code]">): Promise<Response> {
  const { code: rawCode } = await context.params;
  const target = safeRedirectPath(request.nextUrl.searchParams.get(AFFILIATE_TARGET_PARAM), "/");
  // "Não guardar": cada clique precisa chegar aqui (para contar e renovar o cookie).
  const response = NextResponse.redirect(new URL(target, request.url), { headers: { "Cache-Control": "no-store" } });

  const code = normalizeAffiliateCode(rawCode);
  if (!isValidAffiliateCode(code)) return response;
  const affiliate = await findAffiliateByCode(prisma, code);
  if (!affiliate?.isActive) return response;

  try {
    await recordAffiliateClick(affiliate.id);
  } catch (error) {
    // Um erro ao CONTAR o clique não pode impedir a pessoa de chegar ao site nem a indicação de valer.
    console.error(`[afiliados] Falha ao contar o clique de ${code}:`, error);
  }
  response.cookies.set(AFFILIATE_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: AFFILIATE_COOKIE_DAYS * 24 * 60 * 60,
  });
  return response;
}
