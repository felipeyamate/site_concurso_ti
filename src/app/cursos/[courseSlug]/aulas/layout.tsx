/**
 * layout.tsx — Moldura das páginas de aula (/cursos/[curso]/aulas/...).
 *
 * Quem chama: o Next.js, envolvendo as páginas de aula.
 * O que faz: inclui o `SessionRefresher`, que mantém o login renovado enquanto o aluno estuda
 * (regra do CLAUDE.md para toda área logada). O acesso é conferido em cada página.
 */
import { SessionRefresher } from "@/modules/auth/components/session-refresher";

export default function LessonsLayout({ children }: LayoutProps<"/cursos/[courseSlug]/aulas">) {
  return (
    <>
      <SessionRefresher />
      {children}
    </>
  );
}
