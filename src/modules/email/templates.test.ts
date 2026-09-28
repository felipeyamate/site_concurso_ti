/**
 * templates.test.ts — Testes dos textos de e-mail.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { escapeHtml, magicLinkTemplate, resetPasswordTemplate, verifyEmailTemplate } from "./templates";

describe("escapeHtml", () => {
  it("neutraliza HTML digitado pelo usuário", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
});

describe("templates", () => {
  const url = "http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2F";

  it("verificação de e-mail inclui o link e o nome escapado", () => {
    const email = verifyEmailTemplate({ name: "<b>Maria</b>", url });
    expect(email.subject).toBe("Confirme seu e-mail");
    expect(email.html).toContain("&lt;b&gt;Maria&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Maria</b>");
    // No HTML, o "&" do link vira "&amp;" (forma correta dentro de atributos HTML).
    expect(email.html).toContain(escapeHtml(url));
    expect(email.text).toContain(url);
  });

  it("redefinição de senha e link mágico incluem o link", () => {
    expect(resetPasswordTemplate({ name: "Maria", url }).text).toContain(url);
    expect(magicLinkTemplate({ url }).text).toContain(url);
  });
});
