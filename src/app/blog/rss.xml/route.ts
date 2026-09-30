/**
 * route.ts — Feed RSS do blog: /blog/rss.xml  (público)
 *
 * Quem chama: leitores de RSS, agregadores de notícias e o Google (aviso de posts novos).
 * Devolve os 50 posts publicados mais novos, em XML (`buildBlogRssXml`, testada sem o Next).
 * `await connection()`: a resposta vem do banco a cada pedido (sem montar no `next build`).
 */
import "server-only";

import { connection } from "next/server";

import { buildBlogRssXml } from "@/modules/seo/feeds.server";

export async function GET(): Promise<Response> {
  await connection();
  const xml = await buildBlogRssXml(50);
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
