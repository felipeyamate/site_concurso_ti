/**
 * send-email.ts — Envia um e-mail transacional (um e-mail por vez, para uma pessoa).
 *
 * Quem chama: `src/modules/auth/auth.ts` (verificação de e-mail, redefinição de senha,
 * link mágico). Nas próximas fases: confirmação de compra, boas-vindas etc.
 * O que devolve: nada (Promise<void>). Se o envio falhar, lança um erro.
 *
 * Comportamento:
 *  - Com RESEND_API_KEY: envia de verdade pelo Resend.
 *  - Sem a chave, em desenvolvimento/teste: NÃO envia; imprime o e-mail no terminal.
 *    Assim dá para testar o link mágico e a troca de senha sem configurar nada.
 *  - Sem a chave, em produção: erro. Melhor falhar alto do que o aluno nunca receber o e-mail.
 *
 * `async`/`await` aqui funcionam como no `asyncio` do Python: a função "espera" a resposta
 * do Resend sem travar o servidor para outras requisições.
 */
import "server-only";

import { Resend } from "resend";

import { env } from "@/lib/env";

import type { EmailContent } from "./templates";

type SendEmailParams = EmailContent & {
  to: string;
};

// Criado uma única vez (e só se houver chave).
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  if (!resend) {
    if (env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY não configurada: não é possível enviar e-mails em produção.");
    }
    // Modo desenvolvimento: mostra o e-mail no terminal onde o `npm run dev` está rodando.
    console.info(
      [
        "",
        "================ E-MAIL (simulado: RESEND_API_KEY vazia) ================",
        `Para:    ${to}`,
        `Assunto: ${subject}`,
        "",
        text,
        "==========================================================================",
        "",
      ].join("\n"),
    );
    return;
  }

  // O SDK do Resend não lança exceção em erro de envio: ele devolve `{ data, error }`.
  // Por isso checamos `error` e lançamos nós mesmos.
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(`Falha ao enviar e-mail pelo Resend: ${error.message}`);
  }
}
