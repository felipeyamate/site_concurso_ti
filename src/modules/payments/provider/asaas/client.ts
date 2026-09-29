/**
 * client.ts — Conversa com a API do Asaas (requisições HTTP com a chave de API).
 *
 * Quem chama: `asaas-provider.ts` (e os testes, com um `fetch` falso).
 *
 * Endereços (API v3):
 *  - sandbox (testes):  https://api-sandbox.asaas.com/v3
 *  - produção:          https://api.asaas.com/v3
 * A chave vai no cabeçalho `access_token` (nunca na URL, nunca no navegador).
 * Paralelo em Python: um `requests.Session()` com o cabeçalho de autenticação já configurado.
 */
import "server-only";

import { PaymentProviderError } from "../types";

export type AsaasEnvironment = "sandbox" | "production";

const BASE_URLS: Record<AsaasEnvironment, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

// Tempo máximo esperando o Asaas responder (depois disso, erro — melhor que travar a página).
const TIMEOUT_MS = 15_000;

export type AsaasClient = {
  request<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T>;
};

type AsaasErrorBody = { errors?: Array<{ code?: string; description?: string }> };

/**
 * Transforma a resposta de erro do Asaas numa mensagem legível.
 * O Asaas responde erros como `{ "errors": [{ "code": "...", "description": "..." }] }`.
 */
function errorMessage(status: number, body: unknown): string {
  const descriptions = ((body as AsaasErrorBody | null)?.errors ?? [])
    .map((item) => item.description)
    .filter((text): text is string => Boolean(text));
  if (descriptions.length > 0) return descriptions.join(" ");
  if (status === 401) return "Chave de API do Asaas inválida ou sem permissão.";
  return `O Asaas respondeu com erro (HTTP ${status}).`;
}

export function createAsaasClient(options: {
  apiKey: string;
  environment: AsaasEnvironment;
  fetchImpl?: typeof fetch;
}): AsaasClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = BASE_URLS[options.environment];

  return {
    /**
     * Faz uma requisição e devolve o JSON da resposta.
     * Passos: monta a URL e os cabeçalhos; envia (com limite de tempo); se o Asaas respondeu com
     * erro, lança `PaymentProviderError` com a explicação dele.
     */
    async request<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "concurso-ti",
            access_token: options.apiKey,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        });
      } catch (error) {
        throw new PaymentProviderError(
          `Não foi possível falar com o Asaas (${error instanceof Error ? error.message : "erro de rede"}).`,
        );
      }

      const text = await response.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (!response.ok) {
        throw new PaymentProviderError(errorMessage(response.status, data), response.status);
      }
      return data as T;
    },
  };
}
