/**
 * layout.tsx — Moldura de TODAS as páginas do site (HTML base, fontes, cabeçalho, rodapé).
 *
 * Quem chama: o Next.js, automaticamente, envolvendo cada página (`children`).
 * O que devolve: a estrutura HTML comum. Cada página só preenche o miolo.
 *
 * Paralelo em Django: é o `base.html` de onde os outros templates fazem `{% extends %}`.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AnalyticsConsent } from "@/modules/analytics/components/analytics-consent";
import { SITE_DESCRIPTION, SITE_NAME } from "@/modules/seo/site";
import { siteUrl } from "@/modules/seo/site.server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Título e descrição padrão (aba do navegador e Google) e o básico de SEO (Fase 6). Cada página
 * pode sobrescrever com o seu próprio `metadata`.
 *  - `metadataBase`: o endereço do site; com ele, os endereços relativos das páginas (canônico,
 *    imagem de compartilhamento) viram completos (https://...).
 *  - `openGraph`: como o link aparece ao ser compartilhado (WhatsApp, redes sociais).
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: "Concurso TI — Informática e TI para concursos, do zero",
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    openGraph: { siteName: SITE_NAME, locale: "pt_BR", type: "website" },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
        {/* Aviso de cookies + análise (PostHog), só se configurado e só com o aceite (Fase 7, LGPD). */}
        <AnalyticsConsent />
      </body>
    </html>
  );
}
