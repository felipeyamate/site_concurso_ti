/**
 * templates.ts — Textos dos e-mails automáticos (verificação, senha, link mágico).
 *
 * Quem chama: `src/modules/auth/auth.ts`, quando o Better Auth pede para enviar um e-mail.
 * O que devolve: um objeto `{ subject, html, text }` pronto para `sendEmail`.
 *   - `html`: versão bonita, para a maioria dos leitores de e-mail;
 *   - `text`: versão em texto puro (alguns leitores/antispam preferem ter as duas).
 *
 * Funções puras (sem envio), então são fáceis de testar e de pré-visualizar.
 */

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

/**
 * Escapa caracteres especiais de HTML.
 *
 * Por que: o nome do aluno é digitado por ele. Se alguém se cadastrar com um nome como
 * `<script>...`, sem escapar isso viraria código dentro do e-mail. Aqui transformamos
 * `<` em `&lt;` etc., e o texto aparece literalmente.
 * (Paralelo em Python: `html.escape()`.)
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Moldura comum a todos os e-mails: saudação, parágrafo, botão e rodapé.
function renderLayout(params: {
  greetingName?: string;
  paragraph: string;
  buttonLabel: string;
  url: string;
  footnote: string;
}): string {
  const greeting = params.greetingName ? `Olá, ${escapeHtml(params.greetingName)}!` : "Olá!";
  const safeUrl = escapeHtml(params.url);
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
      <p style="font-size:16px;margin:0 0 16px;">${greeting}</p>
      <p style="font-size:16px;line-height:1.5;margin:0 0 24px;">${params.paragraph}</p>
      <p style="margin:0 0 24px;">
        <a href="${safeUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:16px;">${params.buttonLabel}</a>
      </p>
      <p style="font-size:13px;line-height:1.5;color:#71717a;margin:0 0 8px;">Se o botão não funcionar, copie e cole este endereço no navegador:<br>${safeUrl}</p>
      <p style="font-size:13px;line-height:1.5;color:#71717a;margin:0;">${params.footnote}</p>
    </div>
  </body>
</html>`;
}

export function verifyEmailTemplate(params: { name: string; url: string }): EmailContent {
  return {
    subject: "Confirme seu e-mail",
    html: renderLayout({
      greetingName: params.name,
      paragraph: "Falta só um passo: confirme que este e-mail é seu clicando no botão abaixo.",
      buttonLabel: "Confirmar e-mail",
      url: params.url,
      footnote: "Se você não criou uma conta, pode ignorar esta mensagem.",
    }),
    text: `Olá, ${params.name}!\n\nConfirme seu e-mail acessando: ${params.url}\n\nSe você não criou uma conta, ignore esta mensagem.`,
  };
}

export function resetPasswordTemplate(params: { name: string; url: string }): EmailContent {
  return {
    subject: "Redefinição de senha",
    html: renderLayout({
      greetingName: params.name,
      paragraph: "Recebemos um pedido para redefinir a sua senha. Clique no botão para criar uma nova.",
      buttonLabel: "Criar nova senha",
      url: params.url,
      footnote: "O link vale por 1 hora. Se você não pediu a troca, ignore esta mensagem: sua senha continua a mesma.",
    }),
    text: `Olá, ${params.name}!\n\nPara criar uma nova senha, acesse: ${params.url}\n\nO link vale por 1 hora. Se você não pediu, ignore esta mensagem.`,
  };
}

export function magicLinkTemplate(params: { url: string }): EmailContent {
  return {
    subject: "Seu link de acesso",
    html: renderLayout({
      paragraph: "Clique no botão abaixo para entrar na sua conta, sem precisar de senha.",
      buttonLabel: "Entrar agora",
      url: params.url,
      footnote: "O link vale por 5 minutos e só pode ser usado uma vez. Se você não pediu, ignore esta mensagem.",
    }),
    text: `Olá!\n\nPara entrar na sua conta, acesse: ${params.url}\n\nO link vale por 5 minutos e só pode ser usado uma vez.`,
  };
}
