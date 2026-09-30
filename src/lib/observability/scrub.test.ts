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

  it("limpa também os dados extras (argumentos de um console.error capturado), o logentry e os contextos", () => {
    const event = scrubSentryEvent({
      logentry: { message: "falhou para %s", params: ["maria@exemplo.com"] },
      extra: { arguments: ["[checkout] Falha:", { name: "Error", message: "CPF 52998224725 inválido", nested: [["joao@x.com.br"]] }], count: 2 },
      contexts: { cobranca: { cliente: "maria@exemplo.com" } },
    });
    expect(event.logentry).toEqual({ message: "falhou para %s", params: ["[e-mail]"] });
    expect(event.extra).toEqual({ arguments: ["[checkout] Falha:", { name: "Error", message: "CPF [cpf] inválido", nested: [["[e-mail]"]] }], count: 2 });
    expect(event.contexts).toEqual({ cobranca: { cliente: "[e-mail]" } });
  });
});
