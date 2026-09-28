/**
 * layout.tsx (grupo "(auth)") — Moldura das telas de login, cadastro e senha.
 *
 * Quem chama: o Next.js, para as páginas dentro de `src/app/(auth)/`.
 * Pastas entre parênteses, como "(auth)", NÃO aparecem na URL: servem só para agrupar
 * páginas que compartilham este layout (o endereço continua sendo /entrar, /cadastro...).
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 items-start justify-center px-4 py-12 sm:items-center">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
