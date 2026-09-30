/**
 * next.config.ts — Configurações do Next.js (build, cabeçalhos HTTP etc.).
 * Quem usa: o próprio Next.js, ao rodar `npm run dev` / `npm run build`.
 *
 * O que configuramos (Fase 7, produção):
 *  1. Cabeçalhos de segurança em TODAS as respostas (ver `securityHeaders`).
 *  2. Deploys de teste (preview da Vercel) avisam o Google para não indexar (`X-Robots-Tag`).
 *  3. Sentry: com SENTRY_AUTH_TOKEN no build, envia os "mapas" do código para os avisos de erro
 *     mostrarem a linha certa do nosso código. Sem o token, o build segue normal (sem o envio).
 */
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Cabeçalhos de segurança. Paralelo em Python/Django: `SECURE_*` e `X_FRAME_OPTIONS` do settings.py.
const securityHeaders = [
  // O navegador não "adivinha" o tipo de um arquivo (evita um PDF/imagem ser executado como script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ao clicar num link para outro site, ele só fica sabendo o domínio de origem (nunca o caminho,
  // que pode ter o ID de um pagamento, por exemplo).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nenhum site de fora pode abrir as nossas páginas dentro de um <iframe> (golpe do "clique
  // escondido"). O player do Panda é o contrário (nós abrimos o dele), e continua funcionando.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Recursos do aparelho que o site não usa ficam desligados (mesmo que um script de fora tente).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Depois da primeira visita, o navegador só usa HTTPS neste domínio por 2 anos.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const isPreview = process.env.VERCEL_ENV === "preview";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: isPreview ? [...securityHeaders, { key: "X-Robots-Tag", value: "noindex, nofollow" }] : securityHeaders,
      },
    ];
  },
};

// Sentry só "embrulha" a configuração quando há o token de envio (SENTRY_AUTH_TOKEN, no build da Vercel).
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      telemetry: false,
    })
  : nextConfig;
