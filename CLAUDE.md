@AGENTS.md
@PROJECT.md

# Instruções para o Claude neste repositório

- O `PROJECT.md` (importado acima) é a memória do projeto. Siga as regras de código da seção 3
  (cabeçalho em todo arquivo, comentários em português explicando o porquê, paralelos com Python).
- Ao concluir uma fase ou tomar/mudar uma decisão, atualize o `PROJECT.md` (seções 7, 8 e 10)
  e o passo a passo de testes no `README.md`.
- Antes de dar algo como pronto, rode: `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run test:integration` (precisa de `TEST_DATABASE_URL`) e `npm run build`.
- Versões com mudanças grandes em relação a versões antigas — consulte a documentação instalada:
  - Next.js 16: `proxy.ts` substitui `middleware.ts`; `params`/`searchParams`/`headers()` são assíncronos.
    Docs em `node_modules/next/dist/docs/`.
  - Prisma 7: configuração em `prisma.config.ts`, cliente gerado em `src/generated/prisma`
    (importe de `@/generated/prisma/client`), conexão via driver adapter (`@prisma/adapter-pg`).
    `migrate dev` não roda mais o `generate` sozinho: use `npm run db:generate` depois.
  - Better Auth 1.7, Zod 4, Tailwind CSS 4.
- Código de servidor que acessa banco/segredos começa com `import "server-only"`.
- Toda página protegida chama `requireSession`/`requireRole` (`src/modules/auth/session.ts`);
  o `proxy.ts` sozinho não basta.
