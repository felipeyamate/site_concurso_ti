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
- Teste de integração que apaga usuários precisa limpar antes os dados de venda, cupons e afiliados (itens de repasse, repasses,
  cupons, afiliados — ver `resetSales` em `tests/integration/payments.test.ts`);
  o que apaga questões precisa limpar antes `question_attempts` e `mock_exam_questions` (`onDelete: Restrict` na questão).
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
  O que conta como uso: `redemptionWhere` (pago, mesmo reembolsado, + aguardando pagamento). Quem altera/apaga cupom pega a
  mesma trava `coupon:<id>`. O cupom da página de concurso só o ADMIN escolhe (`canChooseCoupon` em `saveNotice`).
- Afiliado: quem indicou a venda só sai de `resolveSaleAttribution` (cupom do afiliado ganha do cookie `ct_afiliado`).
  Comissões são CALCULADAS dos pagamentos (`listAffiliateCommissions`), não gravadas; o que foi pago fica nos itens de
  repasse (`registerAffiliatePayout`, com trava). Link `/r/...` só redireciona para caminhos do site (`safeRedirectPath`).
- Texto do blog/concursos só com `<Markdown>`/`parseMarkdown` (`src/lib/markdown/`); nunca `dangerouslySetInnerHTML`
  (única exceção: `<JsonLd>`, que escapa o conteúdo em `serializeJsonLd`).
- Trocar o slug de curso, aula, post ou página de concurso chama `recordSlugChange` na mesma transação; a página pública
  chama `redirectOldCatalogPathOrNotFound`/`redirectOldSlugOrNotFound` (com `canSeeDrafts`) antes de dar 404 — endereço
  antigo de rascunho nunca redireciona para o público (o 308 revelaria o endereço novo).
- Função de busca usada pela página E pelo `generateMetadata` leva o `cache` do React (ex.: `getPostForViewer`).
- Endereço absoluto do site (canonical, sitemap, RSS, link de afiliado): `siteUrl()`/`absoluteUrl()` (`src/modules/seo/site.server.ts`).
  Sitemap e RSS são montados em `seo/feeds.server.ts`; a rota só faz `await connection()` e chama (os testes chamam direto).
- Botão com texto longo numa linha `flex-wrap`: `h-auto shrink whitespace-normal` (o `Button` tem `shrink-0` e
  `whitespace-nowrap`; sem isso ele alarga a página no celular).
- Componente com `"use client"` só exporta componentes: função usada também no servidor (ex.: `choicesFor`) fica num
  arquivo "puro" (senão a página quebra ao ser montada no servidor).
- Tabela com rolagem lateral: o contêiner `overflow-x-auto` leva `relative` (senão textos `sr-only`
  escapam e alargam a página no celular); e o Card/item de grid que contém a tabela leva `min-w-0`
  (senão a tabela estica o item e a página inteira rola para o lado).
