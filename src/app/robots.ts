/**
 * robots.ts — Regras para os robôs de busca: /robots.txt
 *
 * Quem chama: o Google e outros buscadores, antes de visitar o site.
 * Libera as páginas públicas e pede para NÃO visitar as áreas privadas ou sem valor para busca
 * (painel, área do aluno, checkout, APIs, simulador, links de afiliado). Aponta o sitemap.
 * Obs.: robots.txt é um pedido, não uma trava — quem protege as áreas privadas é o login.
 */
import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/modules/seo/site.server";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/area-do-aluno", "/api/", "/dev/", "/comprar/", "/assinar/", "/simulados", "/r/", "/entrar", "/cadastro"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
