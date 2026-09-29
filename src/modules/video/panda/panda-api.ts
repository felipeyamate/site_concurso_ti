/**
 * panda-api.ts — Conversa com a API do Panda Video para LISTAR os vídeos da sua biblioteca.
 *
 * Quem chama: a ação do painel admin "Escolher da biblioteca do Panda" (`catalog/admin/actions.ts`).
 * O que devolve: uma lista simples de vídeos (ID, título, duração, link do player).
 *
 * API usada (documentação do Panda, "List videos"):
 *   GET https://api-v2.pandavideo.com.br/videos?title=<busca>&page=<n>&limit=<n>
 *   Cabeçalho: Authorization: <sua chave de API>   (sem "Bearer")
 *
 * A chave de API é recebida por parâmetro (quem chama lê do `env`), para este arquivo poder ser
 * testado sem variáveis de ambiente. O `fetch` também pode ser trocado nos testes.
 * Paralelo em Python: é um `requests.get(url, headers=..., timeout=...)` + um modelo pydantic.
 */
import { z } from "zod";

import { parsePandaEmbedInput } from "./embed";

const PANDA_API_URL = "https://api-v2.pandavideo.com.br";
const REQUEST_TIMEOUT_MS = 10_000;

export type PandaLibraryVideo = {
  id: string;
  title: string;
  durationSeconds: number | null;
  status: string | null;
  // Link do player já conferido (`null` se o Panda ainda não gerou, ex.: vídeo processando).
  embedUrl: string | null;
  thumbnailUrl: string | null;
};

// Só os campos que usamos. `.loose()` aceita campos a mais sem erro (a API tem vários outros).
const pandaVideoSchema = z
  .object({
    id: z.string(),
    title: z.string().nullish(),
    length: z.number().nullish(),
    status: z.string().nullish(),
    video_player: z.string().nullish(),
    thumbnail: z.string().nullish(),
  })
  .loose();

const pandaVideoListSchema = z.object({ videos: z.array(pandaVideoSchema) }).loose();

/** Converte a resposta da API no nosso formato (função pura, testada à parte). */
export function mapPandaVideoList(json: unknown): PandaLibraryVideo[] {
  const parsed = pandaVideoListSchema.parse(json);
  return parsed.videos.map((video) => {
    const embed = video.video_player ? parsePandaEmbedInput(video.video_player) : null;
    const thumbnail = video.thumbnail && video.thumbnail.startsWith("https://") ? video.thumbnail : null;
    return {
      id: video.id,
      title: video.title?.trim() || "(sem título)",
      durationSeconds: typeof video.length === "number" && video.length > 0 ? Math.round(video.length) : null,
      status: video.status ?? null,
      embedUrl: embed?.ok ? embed.embedUrl : null,
      thumbnailUrl: thumbnail,
    };
  });
}

export class PandaApiError extends Error {}

/**
 * Busca os vídeos da biblioteca (filtrando pelo título, se `search` vier preenchido).
 *
 * Passos:
 *  1. Monta a URL com a busca e o tamanho da página.
 *  2. Chama a API com a chave no cabeçalho e um tempo máximo de espera.
 *  3. Traduz erros comuns (chave errada, Panda fora do ar) em mensagens claras.
 */
export async function listPandaVideos(params: {
  apiKey: string;
  search?: string;
  limit?: number;
  fetchImpl?: typeof fetch;
}): Promise<PandaLibraryVideo[]> {
  const url = new URL("/videos", PANDA_API_URL);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", String(params.limit ?? 25));
  if (params.search?.trim()) {
    url.searchParams.set("title", params.search.trim());
  }

  const fetchImpl = params.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: params.apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new PandaApiError("Não foi possível falar com o Panda Video agora. Tente de novo em instantes.", {
      cause: error,
    });
  }

  if (response.status === 401 || response.status === 403) {
    throw new PandaApiError("O Panda recusou a chave de API. Confira a PANDA_API_KEY.");
  }
  if (!response.ok) {
    throw new PandaApiError(`O Panda respondeu com erro (${response.status}). Tente de novo em instantes.`);
  }

  try {
    return mapPandaVideoList(await response.json());
  } catch (error) {
    throw new PandaApiError("A resposta do Panda veio num formato inesperado.", { cause: error });
  }
}
