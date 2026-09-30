/**
 * layout.tsx — Moldura de "Resolver questões" (/questoes), que exige login.
 *
 * Quem chama: o Next.js, envolvendo as páginas desta pasta.
 * O que faz: inclui o `SessionRefresher` (renova o login de quem passa horas resolvendo questões).
 * A checagem de login continua na página (`requireSession`).
 */
import { SessionRefresher } from "@/modules/auth/components/session-refresher";

export default function QuestionsLayout({ children }: LayoutProps<"/questoes">) {
  return (
    <>
      <SessionRefresher />
      {children}
    </>
  );
}
