@AGENTS.md
@PROJECT.md

# Instruções para o Claude neste repositório

- O `PROJECT.md` (importado acima) é a memória do projeto. Siga as regras de código da seção 3
  (cabeçalho em todo arquivo, comentários em português explicando o porquê, paralelos com Python).
- Ao concluir uma fase ou tomar/mudar uma decisão, atualize o `PROJECT.md` (seções 7, 8 e 10)
  e o passo a passo de testes no `README.md`.
- Antes de dar algo como pronto, rode: `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run test:integration` (precisa de `TEST_DATABASE_URL`), `npm run build` e `npm run test:e2e`
  (Playwright; usa o banco do `.env.local` com o `npm run db:seed`).
- Versões com mudanças grandes em relação a versões antigas — consulte a documentação instalada:
  - Next.js 16: `proxy.ts` substitui `middleware.ts`; `params`/`searchParams`/`headers()` são assíncronos.
    Docs em `node_modules/next/dist/docs/`.
  - Prisma 7: configuração em `prisma.config.ts`, cliente gerado em `src/generated/prisma`
    (importe de `@/generated/prisma/client`), conexão via driver adapter (`@prisma/adapter-pg`).
    `migrate dev` não roda mais o `generate` sozinho: use `npm run db:generate` depois.
  - Better Auth 1.7, Zod 4, Tailwind CSS 4.
- Código de servidor que acessa banco/segredos começa com `import "server-only"`.
- Toda página protegida chama `requireSession`/`requireRole` (`src/modules/auth/session.ts`);
  o `proxy.ts` sozinho não basta. O `requireSession` também exige o aceite da versão atual dos Termos/Privacidade
  (`LEGAL_VERSION`, `src/modules/legal/version.ts`); `allowPendingLegal` só em `/aceitar-termos`, "Minha conta", "Minhas compras"
  e a página de um pagamento (direitos de quem já comprou não dependem do aceite novo). Ação que cria um contrato novo
  (comprar, assinar) confere `needsLegalAcceptance` também na própria ação.
  Aceite só se grava com `recordLegalConsent` (`src/modules/privacy/consent.server.ts`). Mudança relevante nos textos → nova `LEGAL_VERSION`.
- Sessão: Server Components só LEEM a sessão (`getCurrentSession` usa `disableRefresh`); quem renova o login
  é o `SessionRefresher`. Toda nova área logada precisa de um `layout.tsx` que inclua o `SessionRefresher`.
- Todo PR segue o guia `docs/COMO-REVISAR.md` (descrição com "como testar" e "por onde revisar").
- Acesso a aulas: decidir SEMPRE com `checkLessonAccess` (`src/modules/enrollment/access.ts`), nunca com
  um `if` solto em página/ação. O vídeo (`getLessonPlayback`) só é pedido DEPOIS do acesso liberado.
- Trilhas (Fase 8, `src/modules/tracks/`): a trilha NÃO libera aula — o cadeado de cada passo vem de `buildTrackView`
  (`rules.ts`), que usa `checkLessonAccess` com a matrícula no curso DAQUELA aula. Estrutura (etapas/passos) só por
  `tracks-admin.server.ts`, dentro da trava `track:<id>`; uma aula no máximo uma vez por trilha. Aula, curso, assunto ou
  banca usados numa trilha não se apagam (FK `Restrict` + conferência com mensagem em `deleteLesson`/`deleteCourse`/
  `deleteSubject`/`deleteBoard`). Treino "feito" = questões DIFERENTES do assunto (`listPracticeStats`).
- Aula ↔ assunto: gravar só com `setLessonSubjects` (`catalog-admin.server.ts`); ler com `listStudyLessonsBySubject`/
  `listLessonSubjects` (`src/modules/catalog/lesson-subjects.server.ts`, que já esconde aulas em rascunho).
- Cartões de oferta (produto/plano, com ou sem cupom): `OfferCards` (`src/modules/payments/components/offer-cards.tsx`);
  o cupom só entra quando `previewCoupon` diz que vale para aquela oferta.
- Server Actions que mexem em aula/progresso conferem login + acesso (ver `src/modules/progress/actions.ts`).
- Página que consulta o banco sem ler cookies/headers precisa de `await connection()` (de `next/server`);
  senão o `next build` tenta consultar o banco (e o CI não tem banco no build).
- Conteúdo de exemplo: `npm run db:seed` (`prisma/seed-catalog.ts`, idempotente). Nunca no banco de produção.
- Painel admin: toda Server Action começa com `getSessionWithRole` (`src/modules/auth/action-guards.ts`):
  TEACHER para conteúdo (cursos, aulas, vídeos, PDFs), ADMIN para usuários, perfis e matrículas.
  Formulários usam `useAdminForm` + `FormState`; erros esperados são `UserFacingError` (`src/lib/form-state.ts`).
  Caixas marcadas repetidas (listas) no FormData: `formDataWithLists` (`src/lib/form-state.ts`).
  Exceção: o envio de PDF (3 passos, `attachment-manager.tsx`) não usa o `useAdminForm`, mas usa `FormState` + `FormStatus`.
  Lista de erros detalhados (ex.: por linha da planilha): `FormState.details`, mostrada pelo `FormStatus`.
  Server Action aceita até 1 MB por envio (padrão do Next, mantido): arquivo maior só com conferência antes de enviar.
- Nunca apagar histórico de aluno: curso com matrícula ou aula com progresso de ALUNO não se apaga (despublicar).
  Toda operação "confere e depois grava/apaga" trava as linhas antes de conferir (ver `lockRows` em
  `catalog-admin.server.ts`, `lockEnrollment` em `enrollment/grant.ts` e `withAdvisoryLock` em `src/lib/db-locks.ts`)
  ou faz a conferência e a gravação num comando só (`updateMany` com a condição); senão, um pedido simultâneo passa no meio.
- Vídeo do Panda: link do player só passa por `parsePandaEmbedInput` (`src/modules/video/panda/embed.ts`);
  mensagens do player só com `event.source` do nosso iframe + `isPandaPlayerOrigin`. Produção exige DRM.
- Arquivos (PDFs): sempre via `getFileStorage()` (`src/modules/storage`); o endereço do arquivo nunca vai
  para a página — o download passa por uma rota que confere `checkLessonAccess` e gera link temporário.
- Matrícula MANUAL (painel/script): sempre `grantEnrollment`/`revokeEnrollment` (`src/modules/enrollment/grant.ts`).
  Matrículas de COMPRA/ASSINATURA nunca são gravadas à mão: só o recálculo `syncPaidAccess`
  (`src/modules/payments/access-sync.server.ts`), chamado por `applyChargeUpdate` (`charges.server.ts`) quando um
  pagamento muda. Nunca liberar acesso pela página de "sucesso"/retorno do pagamento.
- Pagamentos: provedor só via `getPaymentProvider()`/`getProviderForRecord()` (`src/modules/payments/provider/provider.server.ts`);
  dados de cartão nunca passam pelo nosso site (o cartão é digitado na página do Asaas).
- Dinheiro sempre em centavos inteiros (`priceCents`); converter só com `centsToReais`/`reaisToCents`/`parseBRLInput`
  (`src/modules/payments/money.ts`). Datas de cobrança pelo dia de Brasília (`src/modules/payments/dates.ts`);
  colunas `@db.Date` (ex.: `dueDate`) são exibidas com `formatDateOnly`, nunca com `formatDateTime`.
- Webhook: confere só o envelope (`parseAsaasEnvelope`: ID e tipo), grava o evento em `webhook_events` ANTES de
  processar, responde 200 mesmo se o processamento falhar (o erro fica registrado para reprocessar) e ignora evento mais
  velho que o último aplicado (`isOutdatedChargeUpdate`).
- Reembolso: chamar o provedor ANTES de gravar; num fluxo com duas chamadas ao provedor, gravar o que ele já aceitou.
  Estorno manual (boleto) marca `manualRefundRequestedAt` — um "paga" do provedor não devolve o acesso.
  Depois que algo foi CRIADO no provedor, não transformar uma falha posterior em "erro ao criar" (ver `createSubscription`
  no Asaas e a assinatura "órfã" em `charges.server.ts`). Erros do provedor para a tela: `providerErrorMessage`.
  Registros financeiros (pedido, pagamento, nota) usam `onDelete: Restrict` e nunca são apagados.
- LGPD: usuário nunca é apagado no site. Excluir conta só por `deleteOwnAccount`/`adminDeleteAccount`
  (`src/modules/privacy/account-deletion.server.ts`), que anonimiza e guarda o fiscal, pega as travas de tudo o que grava
  algo da pessoa (`lockEverythingThatWritesForUser` — trava nova de escrita por aluno entra lá) e apaga os códigos de
  "redefinir senha"; conta excluída não ganha login/senha (`isDeletedAccount` nos ganchos do `auth.ts`) nem resposta
  (`ensureAccountNotDeleted`). Tabela nova com dado pessoal:
  decidir em `anonymizeAccount` (apagar ou guardar, com o motivo) e incluir em `buildPersonalDataExport` ("Baixar meus dados").
  Registro de acesso (Marco Civil): `access_logs`, gravado no login (`recordAccessLog`), 6 meses, apagado pela limpeza diária.
- Sentry sem dado pessoal: tudo passa por `scrubSentryEvent` (`src/lib/observability/scrub.ts`); nada de `sendDefaultPii`,
  gravação de tela ou tracing sem decisão registrada. PostHog (ou outro script de análise) só depois do aceite dos cookies
  (`AnalyticsConsent`, `src/modules/analytics/`), nunca carregado direto no layout, e com `sanitizeAnalyticsEvent` (endereços sem `?...`).
- Tarefa agendada: rota em `src/app/api/cron/...` que confere `isAuthorizedCronRequest` (`src/lib/cron-auth.ts`) antes de tudo,
  registrada no `vercel.json`; a lógica fica num `*.server.ts` que os testes chamam direto.
- Migrações rodam sozinhas no deploy de PRODUÇÃO (`scripts/vercel-build.sh`); preview nunca migra o banco de produção.
  Migração que apaga/renomeia coluna ou tabela vai em duas entregas (primeiro o código para de usar).
- Teste de integração que apaga usuários precisa limpar antes os dados de venda, cupons e afiliados (itens de repasse, repasses,
  cupons, afiliados — ver `resetSales` em `tests/integration/payments.test.ts`) e os aceites (`legal_consents`, `onDelete: Restrict`);
  o que apaga questões precisa limpar antes `question_attempts` e `mock_exam_questions` (`onDelete: Restrict` na questão);
  o que apaga aulas, cursos, assuntos ou bancas precisa apagar antes as trilhas que os usam (`track_items`, `Restrict`).
- Banco de questões: o nível de acesso sai SEMPRE de `getQuestionBankLevelFor` + `checkAnswerPermission`
  (`src/modules/questions/`), nunca de um `if` solto. Gabarito (`correctAnswer`) e comentário (`explanation`) nunca entram
  no `select` de listas nem de simulado em andamento: só saem em `answerQuestion` e no simulado finalizado.
  Responder, criar/salvar/finalizar simulado rodam com `withAdvisoryLock` (`questions:<aluno>` / `mock-exam:<id>`);
  responder também trava a questão com `FOR SHARE` (o painel usa `FOR UPDATE`). Salvar/finalizar simulado conferem o acesso.
  Questão com resposta de ALUNO (`hasStudentHistory`) não muda tipo/letras/gabarito nem se apaga (`questions-admin.server.ts`).
  Relógio na tela: conta a partir do tempo restante medido no servidor, nunca comparando com o relógio do aparelho,
  e se acerta de novo (`mockExamClockAction`) ao abrir e ao voltar para a aba (a página pode vir do cache do "Voltar").
  Questão de simulado em andamento do aluno não aparece nem responde em "Resolver questões". "Quem é aluno" nas
  contas: `STUDENT_USER` (`student-history.ts`). Questão de prova: banca lida com a prova travada (`lockExamsForRead`).
  Planilha: bytes → texto só com `decodeCsvBytes` (UTF-8 ou Windows-1252 do Excel), nunca `file.text()`.
- Cupom: preço com desconto só por `previewCoupon` (tela) e `reserveCoupon` (checkout, dentro da trava do checkout, com a
  trava `coupon:<id>`), em `src/modules/coupons/`; regras puras em `coupons/rules.ts`. Nunca calcular desconto solto na página.
  O que conta como uso: `redemptionWhere` (pago, mesmo reembolsado, + aguardando pagamento, inclusive a assinatura ainda sem
  cobrança). Quem altera/ativa/apaga cupom pega a mesma trava `coupon:<id>`. O cupom da página de concurso só o ADMIN escolhe
  (`canChooseCoupon` em `saveNotice`); renomear o cupom leva junto as páginas. Produto/plano na lista de um cupom não se apaga.
- Afiliado: quem indicou a venda só sai de `resolveSaleAttribution` (cupom do afiliado ganha do cookie `ct_afiliado`).
  Comissões são CALCULADAS dos pagamentos (`listAffiliateCommissions`), não gravadas; o que foi pago fica nos itens de
  repasse (`registerAffiliatePayout`, com trava e com `expectedPaymentIds` = o que a página mostrou).
  Caminho "do site" (link `/r/...`, links do Markdown, voltar do login): sempre `safeRedirectPath`, nunca um `startsWith` solto.
- Texto do blog/concursos só com `<Markdown>`/`parseMarkdown` (`src/lib/markdown/`); nunca `dangerouslySetInnerHTML`
  (única exceção: `<JsonLd>`, que escapa o conteúdo em `serializeJsonLd`).
- Trocar o slug de curso, aula, post, página de concurso ou trilha chama `recordSlugChange` na mesma transação; a página pública
  chama `redirectOldCatalogPathOrNotFound`/`redirectOldSlugOrNotFound` (com `canSeeDrafts`) antes de dar 404 — endereço
  antigo de rascunho nunca redireciona para o público (o 308 revelaria o endereço novo).
- Função de busca usada pela página E pelo `generateMetadata` leva o `cache` do React (ex.: `getPostForViewer`).
- Endereço absoluto do site (canonical, sitemap, RSS, link de afiliado): `siteUrl()`/`absoluteUrl()` (`src/modules/seo/site.server.ts`).
  Sitemap e RSS são montados em `seo/feeds.server.ts`; a rota só faz `await connection()` e chama (os testes chamam direto).
- Botão com texto longo numa linha `flex-wrap`: `h-auto shrink whitespace-normal` (o `Button` tem `shrink-0` e
  `whitespace-nowrap`; sem isso ele alarga a página no celular).
- Componente com `"use client"` só exporta componentes: função usada também no servidor (ex.: `choicesFor`) fica num
  arquivo "puro" (senão a página quebra ao ser montada no servidor).
- Texto sem espaços que vem do usuário (e-mail, link, código) leva `break-all`: senão, no celular, ele alarga a página.
- Tabela com rolagem lateral: o contêiner `overflow-x-auto` leva `relative` (senão textos `sr-only`
  escapam e alargam a página no celular); e o Card/item de grid que contém a tabela leva `min-w-0`
  (senão a tabela estica o item e a página inteira rola para o lado).
