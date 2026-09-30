/**
 * sitemap.ts — O mapa do site para o Google: /sitemap.xml
 *
 * Quem chama: o Google (e outros buscadores), que descobrem por aqui as páginas públicas.
 * Lista: páginas fixas, cursos publicados, posts do blog e páginas de edital publicadas
 * (a montagem fica em `buildSitemapEntries`, testada sem o Next).
 * Nada de área do aluno, painel ou checkout (são privadas).
 * `await connection()`: montado a cada pedido, com o banco (o `next build` não tem banco).
 */
import "server-only";

import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { buildSitemapEntries } from "@/modules/seo/feeds.server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return buildSitemapEntries();
}
