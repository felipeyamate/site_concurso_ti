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
- Sessão: Server Components só LEEM a sessão (`getCurrentSession` usa `disableRefresh`); quem renova o login
  é o `SessionRefresher`. Toda nova área logada precisa de um `layout.tsx` que inclua o `SessionRefresher`.
- Todo PR segue o guia `docs/COMO-REVISAR.md` (descrição com "como testar" e "por onde revisar").
- Acesso a aulas: decidir SEMPRE com `checkLessonAccess` (`src/modules/enrollment/access.ts`), nunca com
  um `if` solto em página/ação. O vídeo (`getLessonPlayback`) só é pedido DEPOIS do acesso liberado.
- Server Actions que mexem em aula/progresso conferem login + acesso (ver `src/modules/progress/actions.ts`).
- Página que consulta o banco sem ler cookies/headers precisa de `await connection()` (de `next/server`);
  senão o `next build` tenta consultar o banco (e o CI não tem banco no build).
- Conteúdo de exemplo: `npm run db:seed` (`prisma/seed-catalog.ts`, idempotente). Nunca no banco de produção.
- Painel admin: toda Server Action começa com `getSessionWithRole` (`src/modules/auth/action-guards.ts`):
  TEACHER para conteúdo (cursos, aulas, vídeos, PDFs), ADMIN para usuários, perfis e matrículas.
  Formulários usam `useAdminForm` + `FormState`; erros esperados são `UserFacingError` (`src/lib/form-state.ts`).
  Exceção: o envio de PDF (3 passos, `attachment-manager.tsx`) não usa o `useAdminForm`, mas usa `FormState` + `FormStatus`.
- Nunca apagar histórico de aluno: curso com matrícula ou aula com progresso de ALUNO não se apaga (despublicar).
  Toda operação "confere e depois grava/apaga" trava as linhas antes de conferir (ver `lockRows` em
  `catalog-admin.server.ts` e `lockEnrollment` em `enrollment/grant.ts`); senão, um pedido simultâneo passa no meio.
- Vídeo do Panda: link do player só passa por `parsePandaEmbedInput` (`src/modules/video/panda/embed.ts`);
  mensagens do player só com `event.source` do nosso iframe + `isPandaPlayerOrigin`. Produção exige DRM.
- Arquivos (PDFs): sempre via `getFileStorage()` (`src/modules/storage`); o endereço do arquivo nunca vai
  para a página — o download passa por uma rota que confere `checkLessonAccess` e gera link temporário.
- Matricular/renovar/revogar: sempre `grantEnrollment`/`revokeEnrollment` (`src/modules/enrollment/grant.ts`).
- Tabela com rolagem lateral: o contêiner `overflow-x-auto` leva `relative` (senão textos `sr-only`
  escapam e alargam a página no celular).
