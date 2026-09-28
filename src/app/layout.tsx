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

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Título e descrição padrão (aparecem na aba do navegador e no Google).
// Cada página pode sobrescrever com o seu próprio `metadata`.
export const metadata: Metadata = {
  title: {
    default: "Concurso TI — Informática e TI para concursos, do zero",
    template: "%s | Concurso TI",
  },
  description:
    "Aprenda Informática, TI e Segurança da Informação para concursos públicos, em linguagem simples, focando no que mais cai nas provas.",
};

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
      </body>
    </html>
  );
}
