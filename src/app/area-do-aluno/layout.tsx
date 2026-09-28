/**
 * layout.tsx — Moldura de todas as páginas da área do aluno (/area-do-aluno/...).
 *
 * Quem chama: o Next.js, envolvendo as páginas desta pasta.
 * O que faz: inclui o `SessionRefresher`, que renova o login enquanto o aluno usa o site.
 * (A checagem de acesso continua em cada página, com `requireSession`.)
 */
import { SessionRefresher } from "@/modules/auth/components/session-refresher";

export default function StudentAreaLayout({ children }: LayoutProps<"/area-do-aluno">) {
  return (
    <>
      <SessionRefresher />
      {children}
    </>
  );
}
