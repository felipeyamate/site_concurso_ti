/**
 * embed.ts — Entende e confere o link do player ("embed") de um vídeo do Panda.
 *
 * Quem chama:
 *  - o painel admin, quando o professor cola o link/código do vídeo (valida antes de salvar);
 *  - o provedor do Panda (`panda-provider.ts`), que confere de novo antes de montar o player;
 *  - o player no navegador, para aceitar mensagens SÓ do player do Panda.
 *
 * Por que conferir tanto: o link vira o `src` de um <iframe> na página da aula. Se aceitássemos
 * qualquer endereço, um cadastro errado (ou malicioso) colocaria outro site dentro da aula.
 *
 * Arquivo "puro" (funciona no servidor e no navegador), testado em `embed.test.ts`.
 */

// Endereços do player do Panda:
//   https://player-vz-<conta>.tv.pandavideo.com.br/embed/?v=<id>   (formato atual)
//   https://player.pandavideo.com.br/embed/?v=<id>                  (formato antigo)
const PLAYER_HOST_PATTERN = /^player(-[a-z0-9-]+)?(\.tv)?\.pandavideo\.com\.br$/;

// O ID de vídeo do Panda é um UUID; aceitamos letras, números e hífens (sem outros símbolos).
const VIDEO_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export type ParsedPandaEmbed =
  | { ok: true; embedUrl: string; videoId: string }
  | { ok: false; error: string };

/** O endereço é de um player do Panda (https e domínio do Panda)? */
export function isPandaPlayerOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && PLAYER_HOST_PATTERN.test(url.hostname) && url.port === "";
  } catch {
    return false;
  }
}

/**
 * Lê o que o professor colou — o link do player OU o código <iframe> inteiro que o Panda mostra
 * em "Incorporar" — e devolve o link limpo e o ID do vídeo.
 *
 * Passos:
 *  1. Se veio um <iframe ...>, pega o `src="..."` de dentro dele.
 *  2. Confere: https, domínio do player do Panda, caminho /embed e parâmetro `v` (o ID do vídeo).
 *  3. Monta o link "limpo" (sem outros parâmetros): https://<player>/embed/?v=<id>.
 *     Os parâmetros extras (ex.: marca d'água) são acrescentados só na hora de tocar.
 */
export function parsePandaEmbedInput(input: string): ParsedPandaEmbed {
  let text = input.trim();
  if (!text) {
    return { ok: false, error: "Cole o link do player do Panda (ou o código de incorporação)." };
  }

  if (text.toLowerCase().includes("<iframe")) {
    const match = text.match(/\ssrc\s*=\s*["']([^"']+)["']/i);
    if (!match) {
      return { ok: false, error: "Não encontramos o endereço (src) dentro do código colado." };
    }
    text = match[1];
  }
  // No código HTML, o "&" entre parâmetros costuma aparecer como "&amp;".
  text = text.replace(/&amp;/g, "&");

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "Isso não parece um link. Copie o link do player no painel do Panda." };
  }

  if (!isPandaPlayerOrigin(url.origin)) {
    return {
      ok: false,
      error: "O link precisa ser do player do Panda (https://player-....pandavideo.com.br/embed/?v=...).",
    };
  }
  if (!/^\/embed\/?$/.test(url.pathname)) {
    return { ok: false, error: "Use o link de incorporação do Panda (o endereço tem /embed/?v=...)." };
  }
  const videoId = url.searchParams.get("v") ?? "";
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    return { ok: false, error: "O link não tem o ID do vídeo (parâmetro v=...)." };
  }

  return { ok: true, embedUrl: `https://${url.hostname}/embed/?v=${videoId}`, videoId };
}
