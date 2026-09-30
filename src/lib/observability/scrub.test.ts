/**
 * scrub.test.ts — Testes da limpeza de dados pessoais dos avisos de erro (Sentry).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { scrubSentryEvent, scrubText } from "./scrub";

describe("scrubText", () => {
  it("troca e-mails e CPFs (com ou sem pontuação) por marcadores", () => {
    expect(scrubText("falhou para Maria.Silva+x@exemplo.com.br")).toBe("falhou para [e-mail]");
    expect(scrubText("CPF 529.982.247-25 e 52998224725")).toBe("CPF [cpf] e [cpf]");
    expect(scrubText("pedido cmabc123 de R$ 197,00")).toBe("pedido cmabc123 de R$ 197,00");
  });
});

describe("scrubSentryEvent", () => {
  it("tira usuário, cookies, corpo, parâmetros e cabeçalhos de login; limpa mensagens e rastro", () => {
    const event = scrubSentryEvent({
      message: "erro com maria@exemplo.com",
      user: { email: "maria@exemplo.com", ip_address: "200.1.2.3" },
      request: {
        url: "https://site.com.br/comprar/curso?cupom=X&email=maria@exemplo.com",
        cookies: "better-auth.session_token=abc",
        data: { cpf: "52998224725" },
        query_string: "email=maria@exemplo.com",
        headers: { Cookie: "a=b", Authorization: "Bearer x", "User-Agent": "Firefox", "x-forwarded-for": "200.1.2.3" },
      },
      exception: { values: [{ value: "CPF 529.982.247-25 já usado" }] },
      breadcrumbs: [{ message: "fetch maria@exemplo.com", data: { url: "/api?email=maria@exemplo.com" } }],
    });
    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: "https://site.com.br/comprar/curso", headers: { "User-Agent": "Firefox" } });
    expect(event.message).toBe("erro com [e-mail]");
    expect(event.exception?.values?.[0].value).toBe("CPF [cpf] já usado");
    expect(event.breadcrumbs).toEqual([{ message: "fetch [e-mail]" }]);
  });
});
