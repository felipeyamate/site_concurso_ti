/**
 * runtime.ts — "Em que tipo de site estamos rodando?" (uma regra só para o app todo).
 *
 * Quem chama: o provedor do vídeo de exemplo (`video/dev-provider.ts`) e o painel admin (que só
 * oferece o vídeo de exemplo onde ele pode tocar).
 *
 * Site de produção = `NODE_ENV=production` E não é um deploy de teste ("preview") da Vercel.
 * Os previews são produção para o Next.js, mas servem para testar — por isso ficam de fora.
 * (Exceção consciente: o Panda exige a marca d'água DRM em QUALQUER execução de produção,
 * inclusive previews, porque o link de um preview pode ser compartilhado — ver `panda-provider.ts`.)
 */
import "server-only";

import { env } from "./env";

export function isProductionSite(): boolean {
  return env.NODE_ENV === "production" && env.VERCEL_ENV !== "preview";
}
