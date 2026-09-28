/**
 * route.ts — Porta de entrada HTTP de toda a autenticação: /api/auth/*
 *
 * Quem chama: o navegador (via `authClient`) e o Google (no retorno do login social).
 * Exemplos de endereços atendidos aqui:
 *   POST /api/auth/sign-up/email        → cadastro com e-mail e senha
 *   POST /api/auth/sign-in/email        → login com e-mail e senha
 *   POST /api/auth/sign-in/magic-link   → pede o link mágico
 *   GET  /api/auth/callback/google      → retorno do login com Google
 *   GET  /api/auth/get-session          → quem está logado
 *
 * A pasta `[...all]` é uma rota "pega-tudo" do Next.js: qualquer caminho abaixo de
 * /api/auth cai neste arquivo, e o Better Auth decide o que fazer.
 * (Paralelo em Django: um `path("api/auth/", include(allauth_urls))`.)
 */
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/modules/auth/auth";

export const { GET, POST } = toNextJsHandler(auth);
