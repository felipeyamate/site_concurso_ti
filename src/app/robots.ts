/**
 * robots.ts — Regras para os robôs de busca: /robots.txt
 *
 * Quem chama: o Google e outros buscadores, antes de visitar o site.
 * Libera as páginas públicas e pede para NÃO visitar as áreas privadas ou sem valor para busca
 * (painel, área do aluno, checkout, APIs, simulador, links de afiliado). Aponta o sitemap.
 * Nos deploys de teste (preview), pede para não visitar nada.
 * Obs.: robots.txt é um pedido, não uma trava — quem protege as áreas privadas é o login.
 */
import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { absoluteUrl } from "@/modules/seo/site.server";

export default function robots(): MetadataRoute.Robots {
  // Deploy de teste (preview da Vercel): nada deve ir para o Google (seria conteúdo duplicado).
  if (env.VERCEL_ENV === "preview") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/area-do-aluno", "/api/", "/dev/", "/comprar/", "/assinar/", "/simulados", "/r/", "/entrar", "/cadastro", "/aceitar-termos"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
