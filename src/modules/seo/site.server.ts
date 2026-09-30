/**
 * site.server.ts — O endereço público do site (ex.: https://concursoti.com.br) e links absolutos.
 *
 * Quem chama: o SEO (endereço "canônico", sitemap, robots, dados estruturados, RSS) e os links de
 * divulgação dos afiliados.
 * Vem de `BETTER_AUTH_URL` (a mesma variável do login: é o endereço do site).
 */
import "server-only";

import { env } from "@/lib/env";

/** "https://concursoti.com.br" (sem barra no fim). */
export function siteUrl(): string {
  return env.BETTER_AUTH_URL.replace(/\/+$/, "");
}

/** "/blog/post" → "https://concursoti.com.br/blog/post". */
export function absoluteUrl(path: string): string {
  return new URL(path, `${siteUrl()}/`).toString();
}
