/**
 * drm.ts — Gera o "token" da marca d'água (DRM) do Panda Video para um aluno.
 *
 * Quem chama: `panda-provider.ts`, a cada abertura de aula (depois de conferir o acesso).
 * O que devolve: um JWT que vai no link do player (`&watermark=<token>`). O Panda confere a
 * assinatura com o segredo do grupo de DRM e desenha os textos do token DENTRO do vídeo
 * (nome, e-mail e ID do aluno), inclusive em tela cheia — quem gravar a tela leva junto a
 * identificação de quem vazou.
 *
 * Formato (documentação do Panda, "Integrar DRM via API"): JWT assinado com HS256 usando o
 * segredo do grupo de DRM, com `drm_group_id`, os textos `string1`, `string2`, `string3` e um
 * prazo de validade (`exp`).
 *
 * Paralelo em Python: é o `jwt.encode(payload, segredo, algorithm="HS256")` da biblioteca PyJWT.
 * Fizemos à mão (com o `crypto` do Node) porque são poucas linhas e evita mais uma dependência.
 */
import "server-only";

import { createHmac } from "node:crypto";

export type WatermarkViewer = { id: string; name: string; email: string };

// Por quanto tempo o link do player vale. Cobre uma sessão longa de estudo; depois disso, basta
// recarregar a página da aula para gerar outro.
export const WATERMARK_TOKEN_TTL_SECONDS = 6 * 60 * 60;

const MAX_TEXT_LENGTH = 80;

function toBase64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function limit(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH - 1)}…` : text;
}

/**
 * Monta e assina o token.
 *
 * Passos:
 *  1. Cabeçalho: algoritmo HS256.
 *  2. Conteúdo: grupo de DRM, os três textos da marca d'água, emissão (`iat`) e validade (`exp`).
 *  3. Assinatura: HMAC-SHA256 de "cabeçalho.conteúdo" com o segredo do grupo.
 */
export function createPandaWatermarkToken(params: {
  groupId: string;
  secret: string;
  viewer: WatermarkViewer;
  nowSeconds: number;
  ttlSeconds?: number;
}): string {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    drm_group_id: params.groupId,
    string1: limit(params.viewer.name || "Aluno"),
    string2: limit(params.viewer.email),
    string3: limit(`ID ${params.viewer.id}`),
    iat: params.nowSeconds,
    exp: params.nowSeconds + (params.ttlSeconds ?? WATERMARK_TOKEN_TTL_SECONDS),
  };
  const unsigned = `${toBase64Url(header)}.${toBase64Url(payload)}`;
  const signature = createHmac("sha256", params.secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}
