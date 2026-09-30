# PROJECT.md — Plataforma de cursos: TI para concursos (para quem não é de TI)

> Este arquivo é a "memória" do projeto. Toda nova etapa de desenvolvimento começa lendo ele.
> Sempre que uma decisão for tomada ou mudada, ela é registrada aqui (seção 8).

---

## 1. Visão do produto

**O que é:** uma plataforma de cursos online que ensina os conteúdos de TI cobrados em concursos
públicos para **cargos que não são de TI** (bancos, tribunais, INSS, agências etc.).

**Para quem:** candidatos iniciantes, sem formação em tecnologia, que precisam garantir pontos em
Informática / Tecnologia da Informação / Segurança da Informação.

**Diferencial:**
1. **Linguagem simples** — explicar TI para quem nunca estudou TI.
2. **Foco no que mais cai** — conteúdo priorizado por incidência real nas provas (por banca e por
   assunto). O aluno estuda primeiro o que dá mais pontos.
3. **Prática guiada** — banco de questões comentadas, filtrável por banca, assunto e concurso.

**Estratégia de conteúdo:**
- **Fase A:** um **Curso Base** ("Informática e TI para Concursos — do zero"), que cobre o núcleo
  comum a quase todos os editais.
- **Fase B:** trilhas **direcionadas** por concurso/banca (ex.: "TI para o Banco do Brasil —
  Cesgranrio"), reaproveitando aulas do Curso Base + aulas específicas.

## 2. Modelo de negócio

A plataforma vende de **duas formas** (as duas desde o início):

| Modelo | Como funciona | Acesso |
|---|---|---|
| **Curso avulso** | Compra única de um curso/trilha | Por tempo determinado (ex.: 12 meses) |
| **Assinatura** | Mensal ou anual | Todos os cursos enquanto estiver ativa |

Formas de pagamento: **Pix, cartão de crédito (parcelado) e boleto**.

## 3. Sobre quem mantém o código

O dono do projeto tem background em **dados e Python**: entende lógica de programação, mas não é
especialista em JavaScript/TypeScript nem em desenvolvimento web.

**Regras de código que isso gera:**
- Todo arquivo começa com um **comentário de cabeçalho** explicando: o que o arquivo faz, quem o
  chama e o que ele devolve.
- Toda função tem comentário explicando **o porquê** e os **passos**, não só o "o quê".
- Quando existir um paralelo útil com Python, ele é citado
  (ex.: "`async/await` aqui funciona como no `asyncio`"; "`zod` é parecido com o `pydantic`").
- Comentários em **português**; nomes de variáveis, funções e arquivos em **inglês** (padrão do
  mercado e das bibliotecas).
- Preferir código **explícito e legível** a código "esperto" e curto.
- Cada fase termina com um **passo a passo de como testar** o que foi feito.

## 4. Stack técnica (decisões)

| Área | Escolha | Por quê | Paralelo em Python |
|---|---|---|---|
| Linguagem | **TypeScript** | Tipos pegam erros antes de rodar | Type hints + mypy |
| Framework web | **Next.js (App Router)** | Site público com SEO + área do aluno + admin num só projeto | Django (full-stack) |
| Banco de dados | **PostgreSQL** (hospedado na **Neon**) | Relacional, robusto, escala bem | — |
| ORM | **Prisma** | Schema legível num único arquivo, migrações automáticas | SQLAlchemy + Alembic |
| Validação de dados | **Zod** | Valida formulários e webhooks | Pydantic |
| Autenticação | **Better Auth** | Dados dos usuários no nosso banco, e-mail/senha + Google + link mágico, controle de sessões | django-allauth |
| Vídeo | **Panda Video** | Brasileiro, marca d'água com dados do aluno, antipirataria, suporte em PT | — |
| Pagamentos | **Asaas** | Pix, boleto, cartão parcelado, assinaturas e **nota fiscal (NFS-e)** integrada | — |
| Arquivos (PDFs) | **Cloudflare R2** | Barato, links assinados que expiram | boto3 + S3 |
| E-mails | **Resend** | E-mails transacionais simples de integrar | — |
| Interface | **Tailwind CSS + shadcn/ui** | Componentes prontos, bonitos e acessíveis | — |
| Hospedagem | **Vercel** | Deploy automático a cada push no GitHub | — |
| Erros | **Sentry** | Avisa quando algo quebra em produção | — |
| Analytics | **PostHog** | Funil de vendas, retenção, uso das aulas | — |
| Testes | **Vitest** (unidade) + **Playwright** (ponta a ponta) | Obrigatórios em pagamento e acesso | pytest |

**Princípio de arquitetura:** *monolito modular*. Um único app, organizado por domínios
(pastas separadas), sem microsserviços. Vídeo, pagamento e e-mail ficam com serviços externos.

**Princípio de troca de fornecedor:** pagamentos e vídeo ficam atrás de uma **interface interna**
(ex.: `PaymentProvider`, `VideoProvider`). Se um dia trocarmos o Asaas pelo Pagar.me, só um arquivo muda.

## 5. Módulos do sistema

1. **Catálogo** — cursos, módulos, aulas, trilhas por concurso/banca.
2. **Contas** — cadastro, login, perfis (`STUDENT`, `TEACHER`, `ADMIN`), limite de sessões.
3. **Checkout e pagamentos** — pedidos, cobranças, webhooks, reembolsos, notas fiscais.
4. **Matrículas (acesso)** — quem pode ver o quê e até quando.
5. **Player e progresso** — reprodução protegida, % concluído, "continuar de onde parou".
6. **Banco de questões** — questões comentadas, filtros, simulados, desempenho do aluno.
7. **Admin** — CRUD de cursos, upload de vídeos/PDFs, alunos, cupons, relatórios.
8. **Marketing** — landing pages por edital, blog (SEO), cupons, afiliados.

## 6. Modelo de dados (rascunho)

```
User ──< Session
User ──< Order ──< Payment
User ──< Subscription
User ──< Enrollment >── Course
User ──< LessonProgress >── Lesson
User ──< QuestionAttempt >── Question

Course ──< Module ──< Lesson  (Lesson tem: vídeo e/ou PDF)
Product ──< ProductCourse >── Course  (um produto pode liberar vários cursos)
Plan (assinatura) → libera todos os cursos marcados como "inclusos na assinatura"
Question >── Subject (assunto), Board (banca), Exam (concurso/ano)   (Question ──< QuestionOption)
User ──< MockExam ──< MockExamQuestion >── Question   (simulados; ao finalizar viram QuestionAttempt)
Coupon ──< Order/Subscription (desconto)   Affiliate ──< Order/Subscription (indicação), Affiliate ──< AffiliatePayout
BlogPost, ExamNotice (página de concurso) ──< ExamNoticeSubject >── Subject, SlugRedirect (endereços antigos)
WebhookEvent (log de tudo que chega dos provedores)
User ──< LegalConsent   (aceites dos Termos/Privacidade: versão, data, IP, navegador)
User ──< AccessLog      (registro de acesso do Marco Civil: cada login, guardado por 6 meses)
Lesson >──< Subject    (LessonSubject: o que a aula ensina → "estude esta aula")
Track (trilha por concurso/banca) ──< TrackSection (etapa) ──< TrackItem (aula de qualquer curso OU treino: assunto + banca + meta)
ExamNotice >── Track   (a trilha indicada na página do concurso)
```

### Regras de negócio que não mudam
- **Pagamento nunca libera acesso direto.** Pagamento confirmado → gera/renova um `Enrollment`.
  Quem decide se o aluno vê uma aula é **só** o `Enrollment`.
- **Acesso só é liberado por webhook confirmado** do provedor, nunca pela página de "sucesso".
- **Webhooks são idempotentes:** o mesmo evento chegando duas vezes não duplica nada
  (todo evento é gravado em `WebhookEvent` com o ID do provedor como chave única).
- **Reembolso/estorno revoga o acesso** automaticamente.
- **Direito de arrependimento (CDC):** 7 dias após a compra.
- **Vídeos e PDFs só com links assinados e temporários**, gerados após checar o `Enrollment`.
- **LGPD:** termos de uso, política de privacidade, consentimento registrado, exclusão de conta.

## 7. Roteiro por fases

| Fase | Entrega | Status |
|---|---|---|
| 0 | Decisões registradas neste arquivo | ✅ concluída |
| 1 | Setup do projeto, banco, schema Prisma, autenticação e papéis | ✅ concluída (ver seção 10) |
| 2 | Catálogo, área do aluno, player, progresso | ✅ concluída (ver seção 10) |
| 3 | Admin: CRUD de cursos, upload de vídeos (Panda) e PDFs (R2) | ✅ concluída (ver seção 10) |
| 4 | Checkout (Asaas), webhooks, matrículas, assinaturas, reembolso, NFS-e | ✅ concluída (ver seção 10) |
| 5 | Banco de questões, simulados, mapa de incidência por banca | ✅ concluída (ver seção 10) |
| 6 | Landing pages por edital, SEO, blog, cupons e afiliados | ✅ concluída (ver seção 10) |
| 7 | Testes E2E, Sentry, LGPD, deploy de produção | ✅ concluída (ver seção 10) |
| 8 | Trilhas por concurso/banca (Fase B do conteúdo) e "estude esta aula" | ✅ concluída (ver seção 10) |

**Cada fase termina com:** código funcionando + testes + instruções de como testar + este arquivo
atualizado.

## 8. Registro de decisões

| Data | Decisão | Motivo |
|---|---|---|
| 2026-09-28 | Construir direto a plataforma própria (sem Hotmart/Kiwify antes) | Escolha do dono do projeto |
| 2026-09-28 | Vender curso avulso **e** assinatura | Atender quem quer só um concurso e quem estuda para vários |
| 2026-09-28 | Começar por um Curso Base, depois trilhas por concurso | Validar o método antes de especializar |
| 2026-09-28 | Orçamento de ferramentas sem restrição rígida | Priorizar qualidade e antipirataria sobre custo |
| 2026-09-28 | Stack da seção 4 | Ver justificativas na tabela |
| 2026-09-28 | Versões: Next.js 16, Prisma 7, Better Auth 1.7, Zod 4, Tailwind CSS 4, Vitest 5, Node 22+ | Versões estáveis atuais. Mudanças importantes: `proxy.ts` no lugar de `middleware.ts` (Next 16); `prisma.config.ts` + cliente gerado em `src/generated/prisma` + driver adapter `pg` (Prisma 7) |
| 2026-09-28 | URLs em português (`/entrar`, `/cadastro`, `/area-do-aluno`, `/esqueci-senha`) | São texto visível para o aluno e ajudam no SEO. Exceção consciente à regra "nomes em inglês", que continua valendo para código, arquivos `.ts` e banco |
| 2026-09-28 | Perfis hierárquicos: STUDENT < TEACHER < ADMIN (`hasMinimumRole`) | Evita listas de perfis repetidas; ADMIN pode tudo que TEACHER pode |
| 2026-09-28 | Perfil nunca é escolhido no cadastro; só muda via `npm run user:set-role` | Impede alguém de se cadastrar como ADMIN. Tela de gestão de perfis fica para a Fase 3 |
| 2026-09-28 | `/admin` exige TEACHER ou mais; lista de usuários só para ADMIN; sem permissão → 404 | 404 não revela que a área existe |
| 2026-09-28 | Limite de **2 dispositivos** logados; o login novo derruba o mais antigo | Antipirataria (compartilhamento de senha) sem bloquear o aluno que troca de aparelho |
| 2026-09-28 | Login dura 7 dias e é renovado a cada dia de uso; trocar a senha desloga os outros dispositivos | Conforto para quem estuda todo dia + segurança se a senha vazar |
| 2026-09-28 | Confirmar o e-mail é um **extra**, não um requisito: o aluno entra sem confirmar (a confirmação é enviada e há aviso na área do aluno) | **Decisão do dono do projeto** (confirmada após a revisão do PR #1): menos atrito no cadastro. Consequência aceita: ver a linha da proteção do link mágico abaixo |
| 2026-09-28 | Rate limit (tentativas de login) guardado no banco (`rate_limits`), ativo só em produção | Na Vercel cada requisição pode cair num servidor diferente; memória não é compartilhada |
| 2026-09-28 | Tabelas e colunas do banco em snake_case (`users.email_verified`) via `@map` | Facilita SQL direto no console da Neon e em ferramentas de dados |
| 2026-09-28 | Schema da Fase 1 só com tabelas de contas; as demais entram na fase em que forem usadas | Evita tabelas sem código e retrabalho de migração |
| 2026-09-28 | Sem `RESEND_API_KEY`: em dev os e-mails são impressos no terminal; em produção dá erro (logado) | Testar tudo localmente sem configurar e-mail, sem falhas silenciosas em produção |
| 2026-09-28 | Migrações de produção aplicadas manualmente (`npm run db:deploy`), não no deploy automático (*mudou na Fase 7: automáticas só no deploy de produção — ver 2026-10-01*) | Evita que um deploy de preview altere o banco de produção. Reavaliar na Fase 7 |
| 2026-09-28 | Testes de integração exigem banco separado (`TEST_DATABASE_URL`, ex.: branch `test` na Neon); CI no GitHub Actions com Postgres temporário | Os testes apagam dados; nunca podem rodar no banco do app |
| 2026-09-28 | Componentes shadcn/ui copiados à mão nesta fase (estilo new-york) | O ambiente do Claude bloqueia `ui.shadcn.com`. Na sua máquina, `npx shadcn@latest add <componente>` funciona normalmente com o `components.json` |
| 2026-09-28 | Páginas do servidor só **leem** a sessão; a renovação diária é feita pelo navegador (`SessionRefresher` nos layouts das áreas logadas) | Encontrado na revisão: renovar durante a renderização estendia o banco mas não o cookie, e o aluno era deslogado em 7 dias mesmo usando o site |
| 2026-09-28 | Quem se cadastra pelo link mágico ganha um nome provisório tirado do e-mail (`maria.silva@...` → "Maria Silva") | O link mágico não pede nome; sem isso a conta ficava com nome vazio |
| 2026-09-28 | Mantida a proteção do Better Auth: entrar pelo link mágico numa conta com e-mail **não confirmado** apaga a senha antiga e desloga os outros dispositivos. A área do aluno avisa "Sua conta não tem senha" e "Esqueci minha senha" cria uma nova | Impede o golpe de alguém se cadastrar antes com o e-mail de outra pessoa. Efeito colateral aceito de não exigir confirmação de e-mail |
| 2026-09-28 | Em produção com Resend, `EMAIL_FROM` com `@resend.dev` impede o app de iniciar | Esse remetente de teste só entrega para o dono da conta do Resend; os alunos não receberiam nada |
| 2026-09-28 | **Fase 2:** catálogo em 3 níveis (Curso → Módulo → Aula); a aula guarda também o `courseId`, e o `slug` é único dentro do curso. URLs: `/cursos/<curso>/aulas/<aula>` | Endereços legíveis e estáveis para o aluno e para o SEO |
| 2026-09-28 | Toda decisão de acesso passa por **uma função só**: `checkLessonAccess` (`src/modules/enrollment/access.ts`). Ordem: professor/admin → rascunho bloqueado → matrícula ativa → aula grátis → bloqueado | Cumpre a regra "quem libera o conteúdo é só a matrícula" e fica fácil de testar (é o código mais sensível) |
| 2026-09-28 | Aula grátis exige **login** (conta gratuita) | Captura o contato do interessado antes de mostrar conteúdo |
| 2026-09-28 | Aula bloqueada mostra o **motivo** (sem matrícula, acesso vencido, cancelado) e o caminho; rascunho para aluno dá 404 | O aluno entende o que fazer; rascunhos não vazam |
| 2026-09-28 | Matrícula: **uma por aluno e curso** (*mudou na Fase 4: uma por aluno, curso **e origem** — ver 2026-09-29*); revogar marca `revokedAt` (não apaga); origem `MANUAL`, `PURCHASE` ou `SUBSCRIPTION`. **Renovar nunca tira dias**: com a matrícula ativa, os dias novos são somados ao que faltava; vencida/revogada recomeça agora; a origem é mantida (`computeEnrollmentRenewal`, reutilizada na Fase 4) | Histórico preservado e pronto para os webhooks da Fase 4 ("gera/renova um Enrollment") |
| 2026-09-28 | Até a Fase 4, matrícula só pelo script `npm run enroll`; até a Fase 3, conteúdo só pelo seed de exemplo (`npm run db:seed`). O seed não roda em produção e para, antes de gravar, se a sincronização fosse apagar progresso de aluno | Cada coisa na sua fase; o seed é só para desenvolvimento e nunca destrói dados de alunos |
| 2026-09-28 | Vídeo atrás da interface de provedor (`src/modules/video`). Hoje só o provedor **DEV** (vídeo de exemplo), **bloqueado em qualquer execução de produção** (exceto os previews da Vercel); se o vídeo falhar, a aula mostra "vídeo indisponível" em vez de derrubar a página. O Panda entra na Fase 3 | Princípio de troca de fornecedor; nunca ir ao ar sem link assinado |
| 2026-09-28 | O endereço do vídeo só é gerado **depois** de conferir o acesso; a página bloqueada não contém vídeo nenhum | Regra "vídeos só depois de checar o Enrollment" |
| 2026-09-28 | Marca d'água nossa, com o e-mail do aluno, mudando de lugar a cada 20 s, por cima de qualquer player | Antipirataria desde já; soma com a do Panda na Fase 3 |
| 2026-09-28 | Progresso salvo a cada 10 s de vídeo, ao pausar, ao sair da aba, ao sair da página da aula e ao terminar — os dois "ao sair" só se o aluno deu play naquela visita (senão apagariam a posição salva). Conclui ao chegar a **90%** (pela posição) ou ao terminar; um salvamento comum nunca apaga a conclusão — só o botão desmarca. Depois de desmarcar, a posição sozinha não conclui de novo até o aluno voltar para antes dos 90% ou terminar o vídeo | Simples e robusto; perder no máximo 10 s se a aba fechar; o "desmarcar" sempre vale |
| 2026-09-28 | "Continuar": última aula assistida se não concluída; senão, a próxima pendente | Comportamento esperado por quem estuda em sequência |
| 2026-09-28 | O banco garante que a aula pertence ao mesmo curso do seu módulo (chave estrangeira composta `(module_id, course_id)`) | A checagem de acesso usa o curso da aula; dados inconsistentes nunca podem liberar ou bloquear errado |
| 2026-09-28 | Quem teve acesso e perdeu (vencido/cancelado) ou ainda vai começar vê o motivo na página do curso, na aula e em "Meus cursos" (o curso continua listado, com o progresso guardado). A aula grátis só é sugerida quando o curso tem uma | Evita mensagens erradas para ex-alunos e para quem tem matrícula futura |
| 2026-09-28 | Trilhas por concurso/banca (Fase B do conteúdo) e reaproveitamento de aulas entre cursos ficam para depois (tabela de ligação quando for preciso); PDFs das aulas entram com o R2 na Fase 3 (*trilhas feitas na Fase 8 — ver 2026-10-02*) | Não criar tabelas sem uso |
| 2026-09-28 | No celular, o cabeçalho esconde o botão "Criar conta" (continua na página inicial, no login e nos cursos) | Os 3 botões não cabiam em telas de 360 px |
| 2026-09-29 | **Fase 3:** painel em `/admin` — PROFESSOR gerencia cursos, módulos, aulas, vídeos e PDFs; só ADMIN gerencia usuários, perfis e matrículas. Toda Server Action do painel confere login + perfil de novo (`getSessionWithRole`) | Separar conteúdo de dados pessoais/financeiros; uma Server Action pode ser chamada direto por HTTP |
| 2026-09-29 | Cursos e aulas novos nascem como **rascunho**; tirar do ar = despublicar. **Não se apaga** curso com matrícula (mesmo vencida) nem aula que um ALUNO assistiu; módulo só é apagado vazio | Nunca perder histórico de aluno; o progresso de professor testando não bloqueia |
| 2026-09-29 | Vídeo do Panda: a aula guarda o **link do player** (conferido: só https no domínio do player do Panda) + o ID. O professor cola o link ou o código `<iframe>`; com `PANDA_API_KEY`, escolhe da biblioteca | Cada conta do Panda tem seu endereço de player; nunca montar `<iframe>` com endereço de fora |
| 2026-09-29 | Marca d'água **DRM do Panda** (nome, e-mail e ID do aluno dentro do vídeo) com token JWT que vence em 6 h. Em **produção sem DRM configurado, a aula do Panda não toca**; em desenvolvimento toca com aviso | Regra "vídeo só com link assinado e temporário"; a marca d'água aparece em tela cheia (a nossa não) |
| 2026-09-29 | Progresso do Panda pelas mensagens do player (`panda_timeupdate`, `panda_pause`, `panda_ended`...), aceitando só mensagens do nosso `<iframe>` e do domínio do Panda; "continuar de onde parou" pede ao player para pular (`currentTime`) | Mesmas regras de progresso da Fase 2, sem confiar em mensagens de outras origens |
| 2026-09-29 | PDFs: o navegador envia **direto** para o armazenamento (link de envio de 10 min) e o servidor confere tamanho/tipo antes de registrar. Download por uma rota nossa que confere o acesso (`checkLessonAccess`) a cada clique e redireciona para um link de 5 min. Limite de 50 MB por PDF | Sem limite de tamanho da Vercel no caminho; o endereço real do arquivo nunca aparece na página |
| 2026-09-29 | Armazenamento atrás da interface `FileStorage`: **Cloudflare R2** (SDK S3) quando configurado; senão, **pasta local** só em desenvolvimento (com links assinados por HMAC, como o R2); em produção sem R2, envio de PDFs desligado com aviso | Testar tudo sem conta no R2, com o mesmo fluxo de produção |
| 2026-09-29 | Matrícula manual pelo painel e pelo script usam a mesma função (`grantEnrollment`/`revokeEnrollment`), que a Fase 4 também usará | Uma regra só para "gerar/renovar um Enrollment" |
| 2026-09-29 | Perfis pelo painel: ninguém muda o próprio perfil e o site nunca fica sem ADMIN. O script `user:set-role` continua para criar o primeiro ADMIN | Evitar perder o acesso ao painel por engano |
| 2026-09-29 | Formulários do painel não apagam o que foi digitado quando a validação falha (`useAdminForm`) | O modo padrão do React 19 limpa o formulário a cada envio |
| 2026-09-29 | Regras de progresso do Panda numa máquina de estados testável (`panda/progress-tracker.ts`): só salva depois de o vídeo avançar de verdade; insiste no "continuar de onde parou" por até 5 s após o play; a **duração só vale se vier do player** (sem ela, conclui ao terminar o vídeo ou pelo botão) | Achados da revisão: um pulo nosso com o vídeo parado contava como "assistiu"; um pulo perdido apagava a posição salva; uma duração digitada errada concluía a aula cedo |
| 2026-09-29 | "Histórico de aluno" = progresso de quem é aluno OU tem/teve matrícula no curso (aluno promovido a monitor continua protegido). Troca de perfil em transação serializável | Achados da revisão: o critério pelo perfil atual deixava apagar o histórico de um aluno promovido; dois admins rebaixando um ao outro ao mesmo tempo deixariam o site sem admin |
| 2026-09-29 | **Travas no banco** para operações "confere e grava": apagar curso/módulo/aula trava as linhas antes de conferir o histórico (`SELECT ... FOR UPDATE`); matricular/renovar/revogar usa uma trava por aluno+curso (`pg_advisory_xact_lock`) | Segunda revisão: sem trava, duas renovações ao mesmo tempo somavam só uma (ex.: webhook da Fase 4 + painel), e um progresso gravado no meio de um "apagar aula" era apagado junto |
| 2026-09-29 | O link de envio de PDF só aceita **aquele** arquivo: tipo e tamanho exato entram na assinatura (no R2, `signableHeaders`; o SDK deixa o tipo de fora por padrão) | Segunda revisão: o link vale 10 min e podia ser reusado depois da confirmação para trocar o PDF conferido por um arquivo maior ou de outro tipo |
| 2026-09-29 | **Fase 4:** matrícula passa a ser **uma por aluno, curso e origem** (`MANUAL`, `PURCHASE`, `SUBSCRIPTION`). A manual continua com `grantEnrollment`/`revokeEnrollment`; as de compra e assinatura são **recalculadas** a partir dos pagamentos (`syncPaidAccess`). O aluno vê o curso se **qualquer** uma estiver ativa (`mergeEnrollments`) | Um reembolso da compra não pode derrubar uma matrícula manual (ou vice-versa); recalcular do zero é idempotente — o mesmo aviso chegando duas vezes dá o mesmo resultado |
| 2026-09-29 | Acesso pago: compras são "reaplicadas" em ordem de pagamento com `computeEnrollmentRenewal` (recomprar soma dias); assinatura libera até o **vencimento do ciclo seguinte + 5 dias** de tolerância, sempre até o **fim do dia** (Brasília). Assinatura **cancelada** perde a tolerância: vale até a véspera do vencimento seguinte | Mesma regra de renovação da Fase 2; a tolerância evita cortar o aluno por um atraso de compensação, mas não faz sentido quando não há próximo pagamento. "Acesso até 06/11" na tela vale o dia 06/11 inteiro |
| 2026-09-29 | Asaas: **cartão** é digitado na página segura do Asaas (os dados do cartão nunca passam pelo nosso site); **Pix** mostra o QR code na nossa página; **boleto** é um link. Parcelamento só no cartão, até 12x sem juros, parcela mínima de R$ 5 | Sem obrigação de PCI; Pix e boleto sem sair do fluxo |
| 2026-09-29 | Aviso do Asaas (webhook): confere o token (`asaas-access-token`), **grava antes de processar** (`webhook_events`, chave única por provedor + ID do evento), responde 200 mesmo se o processamento falhar (o erro fica registrado e dá para reprocessar pelo painel) e ignora aviso mais velho que o último aplicado | Idempotência e nenhuma perda de aviso: se respondêssemos erro, o Asaas pausaria a fila inteira de avisos |
| 2026-09-29 | Reembolso: o **aluno** pede em até **7 dias** do pagamento (CDC); o **admin** pode a qualquer momento. O acesso sai **na hora** do pedido; boleto é estornado à mão no painel do Asaas; se o Asaas negar o estorno, o acesso volta. Na assinatura, os 7 dias valem só para o **primeiro** pagamento; cancelar mantém o período já pago | Direito de arrependimento sem brecha de "pedir reembolso e continuar assistindo" |
| 2026-09-29 | O pedido guarda uma **"foto"** do que foi vendido (título, preço, dias, cursos); registros financeiros não se apagam (`onDelete: Restrict`); produto/plano com venda e curso com pedido não se apagam (desativar) | Mudar o preço amanhã não altera o que o aluno comprou hoje; histórico fiscal preservado |
| 2026-09-29 | CPF obrigatório na primeira compra e **travado** depois (troca só pelo suporte); limite de **10 pedidos/assinaturas novos por dia** por aluno e **uma assinatura ativa** por vez | O Asaas exige CPF para emitir cobrança/nota; evita abuso e cobrança em dobro |
| 2026-09-29 | Sem `ASAAS_API_KEY`, em desenvolvimento entra o provedor **FAKE** com um simulador (`/dev/pagamentos/...`) que gera avisos no formato do Asaas e passa pelo mesmo código. Em produção sem chave, ou com a chave do **sandbox**, as vendas ficam desligadas | Testar tudo sem conta no Asaas; no sandbox, cartões de teste "pagam" de mentira e liberariam acesso de graça |
| 2026-09-29 | Nota fiscal (NFS-e) **opcional** (`NFSE_ENABLED`): agendada no Asaas quando o pagamento é confirmado e cancelada no reembolso/chargeback. Só ISS configurável | Depende do cadastro municipal e da orientação do contador; a venda não pode parar por causa da nota |
| 2026-09-29 | Curso entra na assinatura pela marca "incluso na assinatura" (tela do plano); ao mudar a lista, o acesso de todos os assinantes é recalculado na hora | Regra do modelo de negócio (seção 2) sem precisar de um script |
| 2026-09-29 | Dinheiro sempre em **centavos inteiros** (`priceCents`); datas de cobrança pelo **dia de Brasília** (`payments/dates.ts`); Pix e cartão vencem em 1 dia, boleto em 3 | Sem erro de arredondamento de `float`; sem cobrança "vencendo ontem" por causa do fuso |
| 2026-09-30 | **Revisão da Fase 4:** reembolso, cancelamento e checkout rodam com **trava** (pedido, assinatura, aluno), com as chamadas ao provedor dentro dela; no cancelamento com reembolso, o **estorno vem antes** do cancelamento (se o provedor recusar o estorno, nada muda; se recusar o cancelamento depois, o estorno fica gravado e o aluno tenta cancelar de novo) | Achados da revisão: duplo clique gerava dois estornos ou duas assinaturas recorrentes; uma falha do provedor no meio fazia o aluno perder o direito aos 7 dias |
| 2026-09-30 | Estorno de **boleto** (manual no painel do Asaas) marca a cobrança (`manualRefundRequestedAt`): enquanto o Asaas ainda mostrar "paga", nenhum aviso nem "Conferir no Asaas" devolve o acesso; quando o Asaas mostrar o estorno, a marca some | Achado da revisão: o "Conferir no Asaas" desfazia o reembolso e devolvia o acesso |
| 2026-09-30 | Estorno negado (ou contestação revertida) com a nota fiscal já cancelada → **nota nova** para a mesma cobrança | A venda valeu; sem isso ela ficava sem nota |
| 2026-09-30 | Aviso do Asaas é guardado se tiver **ID e tipo**; o resto é conferido no processamento (formato inesperado = aviso guardado com erro, resposta 200, reprocessável). Dois avisos no **mesmo segundo**: vale o status mais adiantado (ex.: "estornada" ganha de "estorno em andamento") | Antes, um formato inesperado era recusado (o Asaas pausaria a fila); o horário do Asaas só tem segundos |
| 2026-09-30 | **Segunda revisão da Fase 4:** assinatura que existe no Asaas mas cuja criação falhou aqui ("órfã") é **cancelada lá** assim que a 1ª cobrança dela é avisada; depois de criada no Asaas, uma falha ao buscar a 1ª cobrança não vira erro | A resposta do Asaas pode se perder (tempo esgotado): sem isso, o aluno via "não foi possível assinar" e o Asaas continuava gerando cobranças |
| 2026-09-30 | Com a cobrança em "estorno em andamento", a **resposta do provedor** (estornada, contestada, estorno negado) sempre vale, mesmo com horário "antes" do nosso pedido | O pedido de estorno é carimbado pelo nosso relógio e o aviso pelo do Asaas; segundos de diferença descartavam a resposta |
| 2026-09-30 | Nota fiscal com cancelamento **em andamento** na prefeitura e estorno negado: espera a resposta — cancelada → nota nova; cancelamento recusado → vale a antiga | Nunca duas notas válidas para a mesma venda |
| 2026-09-30 | "Conferir no Asaas" que descobre um pagamento usa o **dia do pagamento** informado pelo Asaas (não a hora do clique) | O prazo de 7 dias do reembolso e o início do acesso contam do pagamento |
| 2026-09-30 | Com um estorno em andamento na assinatura, "cancelar e estornar" de novo é recusado (e o botão some no painel); estorno de boleto pendente em assinatura aparece na visão geral e na página da assinatura | Achados da revisão: repetir o botão estornava um segundo ciclo; o estorno manual da assinatura ficava invisível |
| 2026-09-30 | **Fase 5:** banco de questões com classificação em **banca**, **assunto** e **prova** (concurso + ano). Questão de prova herda a banca da prova; questão inédita pode ter uma banca "no estilo de". Dois tipos: **múltipla escolha** (A a E, de 2 a 5 alternativas) e **Certo/Errado** (estilo Cebraspe). Texto puro (sem imagens/formatação) nesta fase | Filtros que o aluno usa na prova ("Cesgranrio, Segurança"); o mapa de incidência precisa saber de que prova veio cada questão |
| 2026-09-30 | Acesso ao banco de questões numa função só (`getQuestionBankLevelFor` + `checkAnswerPermission`): **qualquer matrícula ativa** (curso avulso, assinatura ou manual) ou professor/admin = **acesso completo**; conta gratuita = **10 respostas por dia** (dia de Brasília), contando as repetidas (*segunda revisão: só as de "Resolver questões"; as de simulado não gastam a cota*). Simulados só com acesso completo | A questão grátis atrai o aluno (como a aula grátis) sem entregar o banco inteiro; a mesma regra de "quem tem curso" da Fase 2/4 |
| 2026-09-30 | Gabarito e comentário **nunca** vão para a página antes da resposta (na prática) ou antes de finalizar (no simulado); a cota grátis e a resposta são gravadas com uma trava por aluno | Ver o código da página não pode entregar a resposta; sem a trava, várias respostas ao mesmo tempo passavam da cota |
| 2026-09-30 | Toda resposta fica guardada (`question_attempts`), inclusive as repetidas e as dos simulados; o desempenho conta todas. "Que errei" = errou alguma vez e **ainda não acertou**. "X% dos alunos acertaram" só aparece com 10+ respostas (*segunda revisão: 10+ ALUNOS, olhando a primeira resposta de cada um*) | Histórico completo para o desempenho por assunto; a lista "que errei" esvazia conforme o aluno aprende |
| 2026-09-30 | Simulado: de 10 a 60 questões, com ou sem tempo de prova (15 min a 4 h); sorteia primeiro as questões que o aluno **nunca respondeu**; no máximo **3 em andamento**; respostas salvas a cada clique; o tempo tem **30 s de tolerância** (a última resposta a caminho do servidor); questão em branco conta como erro; ao finalizar, as respostas entram no desempenho. Sem gabarito até finalizar | Simular a prova de verdade, sem repetir sempre as mesmas questões; a tolerância evita perder a última marcação por atraso da rede |
| 2026-09-30 | Mapa "o que mais cai" (`/o-que-mais-cai`, público): % das questões **de prova publicadas** por assunto, geral e por banca. Questões inéditas não entram | Mostrar incidência real ("o que já caiu"), que é o diferencial do produto; página pública ajuda no SEO |
| 2026-09-30 | Histórico do aluno protegido: questão respondida (na prática ou em simulado) não se apaga (despublicar) e não muda de **tipo**, **letras** nem **gabarito** — só os textos. Banca, assunto e prova com questões não se apagam. Trocar a banca de uma prova leva junto a banca das questões dela | Mudar o gabarito depois reescreveria o "acertou/errou" que o aluno já viu; mesma regra de "nunca apagar histórico" das Fases 2–4 |
| 2026-09-30 | Importação por planilha CSV (`;` ou `,`, com acentos do Excel) **tudo ou nada**, até 500 linhas; as questões entram como **rascunho**; a coluna `codigo` (opcional, única) impede importar a mesma questão duas vezes | O professor corrige a planilha e importa de novo sem duplicar nada; revisa antes de publicar |
| 2026-09-30 | Conteúdo de exemplo do banco de questões no seed (4 bancas, 6 assuntos, 30 questões) com provas **fictícias** ("Prova de exemplo — ...") | Testar tudo sem copiar provas reais; o conteúdo real entra pelo painel |
| 2026-09-30 | **Revisão da Fase 5:** "histórico de aluno" numa questão = resposta ou simulado de quem é **aluno** ou tem/teve matrícula (mesma regra das aulas); o professor testando não trava a questão, e apagá-la leva junto os testes dele. Responder trava a linha da questão para leitura (`FOR SHARE`), esperando um professor que esteja trocando o gabarito naquele instante | Achados da revisão: um teste do professor impedia corrigir o gabarito; uma resposta no mesmo instante da troca era corrigida com o gabarito antigo |
| 2026-09-30 | Salvar e finalizar um simulado conferem o acesso completo de novo: quem perdeu o acesso (reembolso, fim da assinatura) vê um aviso e o simulado fica aberto até o acesso voltar. O relógio do simulado conta a partir do tempo restante medido pelo **servidor** | Finalizar entrega o gabarito e os comentários; um relógio errado no aparelho do aluno encurtava (ou alongava) a prova |
| 2026-09-30 | Planilha de importação com no máximo **900 KB** (conferido no navegador antes de enviar) | O Next aceita até 1 MB por envio numa Server Action; aumentar esse limite valeria para todas as ações do site |
| 2026-09-30 | **Segunda revisão da Fase 5:** questão que está num simulado do aluno **em andamento** some de "Resolver questões" (e a resposta é recusada) até ele finalizar; a cota grátis conta só as respostas de "Resolver questões"; "X% dos alunos acertam" usa a **primeira resposta de cada aluno** (10+ alunos; professor testando não conta) | Achados da revisão: responder na prática entregava o gabarito do simulado aberto; quem perdia o acesso via a cota "gasta" pelo simulado; um aluno repetindo 10 vezes já gerava a porcentagem |
| 2026-09-30 | Planilha aceita UTF-8 **e** Windows-1252 (o "CSV separado por ponto e vírgula" do Excel em português); gravar questão de prova trava a prova para leitura (a banca é lida com a prova travada); o relógio do simulado se acerta com o servidor ao abrir a página e ao voltar para a aba; a lista de simulados mostra sempre os em andamento | Achados da revisão: acentos viravam "�"; questão gravada durante a troca de banca da prova ficava com a banca antiga; o botão "Voltar" devolvia minutos ao relógio; simulado aberto antigo sumia da lista |
| 2026-09-30 | **Fase 6 — cupons:** desconto em **%** (1 a 100) ou em **R$**; vale para compras avulsas e/ou assinaturas (com lista opcional de produtos/planos); validade por **dia de Brasília** (o último dia vale inteiro); limite de usos no total e **por aluno**. O preço final nunca fica abaixo de **R$ 5,00** (mínimo de cobrança) — o cupom é recusado. Na assinatura, o desconto vale para **todas as renovações** | Regras simples de explicar na divulgação; o mínimo evita cobrança que o Asaas recusaria |
| 2026-09-30 | Cupom conferido **duas vezes**: na página (prévia com o preço riscado) e de novo no checkout, **com uma trava por cupom** (`coupon:<id>`) dentro da trava do checkout. Conta como uso: pedido **pago** (mesmo que depois reembolsado) e pedido **aguardando pagamento** (reserva); pedido **vencido** sem pagamento ou cancelado devolve o uso (*mudou na revisão da Fase 6 — ver abaixo*). O pedido guarda o código e o desconto ("foto") | Sem a trava, duas compras ao mesmo tempo passavam do limite (teste que falha sem ela); pedir reembolso não "devolve" o cupom para usar de novo |
| 2026-09-30 | **Afiliados:** o admin cadastra (a pessoa precisa ter conta). Link `/r/<codigo>?para=/pagina` conta o clique e guarda um cookie de **30 dias** (vale o **último** link clicado); o destino só pode ser uma página do nosso site. Cupom ligado a um afiliado **ganha** do cookie; ninguém é afiliado de si mesmo; afiliado desativado não ganha vendas novas | Modelo comum de mercado; o cupom é a indicação mais explícita; o link nunca vira um redirecionador para sites de golpe |
| 2026-09-30 | Comissão: a **taxa** é gravada no pedido/assinatura na hora da venda; a comissão é calculada **a cada pagamento pago** (na assinatura, todo mês/ano pago), fica **7 dias em carência** (prazo do reembolso) e é **cancelada** por reembolso/contestação. O pagamento ao afiliado é feito **fora do site** (Pix) e só **registrado** pelo admin (com trava); comissão já paga e depois estornada aparece marcada para acerto manual | Mudar a taxa não altera vendas antigas; nada de pagar comissão de venda devolvida; sem integrar split de pagamento por enquanto |
| 2026-09-30 | **Blog e páginas de concurso** escritos em **Markdown** (títulos, negrito, itálico, links, listas, citações) com um leitor **nosso**: o texto vira elementos da página, nunca HTML cru; links só `https://`, `mailto:` e endereços do site. Nascem como **rascunho**; o professor vê a prévia no endereço real; a data de publicação é a da **primeira** publicação | Segurança (um texto colado não consegue rodar script) e ninguém precisa saber HTML |
| 2026-09-30 | Página de concurso (`/concursos/<endereco>`): situação, banca, datas, vagas, texto, assuntos com "treinar questões", "o que mais cai na banca" e a oferta (produto e/ou plano) com um **cupom já aplicado** no botão — só na oferta em que o cupom **vale hoje**, com o preço final (*revisão da Fase 6*). Oferta inativa some da página. O seed tem uma página **fictícia** | Landing page por edital (seção 1, Fase B do conteúdo) reaproveitando o banco de questões e o mapa |
| 2026-09-30 | **SEO:** endereço canônico e OpenGraph em todas as páginas públicas, `sitemap.xml`, `robots.txt` (bloqueia painel, área do aluno, checkout e `/r/`), dados estruturados (escola, site, curso, artigo, trilha) e RSS do blog. Trocar o endereço (slug) de curso, aula, post ou página de concurso grava o antigo e ele **redireciona** para o novo (permanente) | Pendência da Fase 3 resolvida; o Google não perde as páginas já indexadas |
| 2026-09-30 | Páginas públicas continuam montadas **a cada acesso** (sem cache): o `sitemap`, o RSS e as páginas usam `connection()` | Simples e sempre atualizado; cache entra quando o movimento pedir (*continua sem cache depois da Fase 7: ver pendências*) |
| 2026-09-30 | **Revisão da Fase 6:** pedido **vencido** sem pagamento devolve o uso do cupom (o aguardando pagamento continua sendo uma reserva, com a mensagem "você já tem um pedido com o cupom aguardando pagamento"); a página de concurso só mostra o cupom na oferta em que ele vale hoje; o **cupom da página só o ADMIN escolhe** (o professor edita o resto e o cupom atual fica); endereço antigo de **rascunho** não redireciona para o público; editar/apagar cupom usa a **mesma trava do checkout**; "vendas indicadas" do afiliado contam só vendas pagas | Achados da revisão: um Pix esquecido travava o cupom do aluno para sempre; a página prometia desconto que o checkout recusava; o professor podia "adivinhar" cupons pela mensagem de erro; o 308 revelava o endereço novo de um rascunho; trocar o código no instante de uma compra deixava o pedido com um código que não existe mais |
| 2026-09-30 | **Segunda revisão da Fase 6:** assinatura recém-criada (antes de a 1ª cobrança ser gravada) já reserva o cupom; produto/plano que está na lista de um cupom **não se apaga** (a lista vazia faria o cupom valer para tudo); registrar o pagamento ao afiliado confere se as comissões liberadas são **as mesmas que a página mostrava**; trocar o código de um cupom **leva junto** as páginas de concurso que o usam (e cupom usado numa página não se apaga); links do Markdown e do afiliado usam a mesma conferência do login (`safeRedirectPath`); cada página do blog tem o seu endereço canônico | Achados da revisão: dois alunos levavam o último uso de um cupom de assinatura; apagar um produto sem vendas transformava um cupom restrito em cupom para tudo; uma comissão liberada no meio-tempo era registrada como paga sem ter sido paga; a página de concurso perdia o desconto (ou passava a usar outro cupom) ao renomear o cupom; um link "/\\site" do Markdown levava para fora do site |
| 2026-10-01 | **Fase 7 — LGPD:** Termos e Privacidade têm **versão** (`LEGAL_VERSION`); o cadastro exige marcar "Li e aceito" e cada aceite fica registrado (`legal_consents`: versão, data, IP e navegador). Quando a versão muda, toda área logada leva antes à tela de aceite (`requireSession` → `/aceitar-termos`), que depois volta para onde a pessoa ia — **exceto** "Minha conta", "Minhas compras" e a página de um pagamento (cancelar, reembolsar, pagar o que já foi gerado e excluir a conta não dependem do aceite). O aceite "no cadastro" só é gravado para conta de **e-mail e senha** criada há até 10 min que nunca aceitou nada; comprar/assinar confere o aceite também na ação, não só na página (*revisões da Fase 7*) | Prova do consentimento (art. 8º da LGPD) e aviso claro quando as regras mudam, sem bloquear quem só quer sair ou ler os textos |
| 2026-10-01 | **Excluir a conta** = **anonimizar**: apaga logins, progresso, respostas, simulados, telefone e chave Pix (o CPF fica só se houve compra: nota fiscal); nome vira "Conta excluída" e o e-mail, um endereço inválido (o e-mail real fica livre para um cadastro novo). Pedidos, pagamentos, notas e aceites **ficam** (obrigação fiscal/legal), sem nome. Pede a frase "EXCLUIR MINHA CONTA" e login feito há **até 15 min**; bloqueada com assinatura ativa, pagamento aguardando, **cobrança vencida há menos de 30 dias** (dia de Brasília; ainda pode ser paga com atraso) ou **reembolso em andamento** (*revisões da Fase 7*). A exclusão pega as travas de tudo o que grava algo da pessoa (checkout, respostas, simulados abertos, reembolso/cancelamento de cada pedido e assinatura), apaga os códigos de "redefinir senha" e, depois dela, a conta não ganha login nem senha nova (ganchos do Better Auth); o progresso de aula gravado "no mesmo instante" sai na limpeza diária; professor/admin não se excluem por aqui; o admin exclui digitando o e-mail da conta. Roda com a trava do checkout (`checkout:<aluno>`) | Direito de eliminação (art. 18) sem apagar registros que a lei manda guardar; sem assinatura "fantasma" cobrando quem saiu; um celular esquecido logado não exclui a conta de ninguém |
| 2026-10-01 | **Registro de acesso** (Marco Civil da Internet, art. 15): data, hora, IP e navegador de **cada login** (`access_logs`), gravados pelo gancho de login do Better Auth, guardados por **6 meses** (186 dias) — inclusive depois da exclusão da conta — e apagados pela limpeza diária. Uma falha ao gravar não impede o login | A lei obriga site com fins comerciais a guardar os acessos por 6 meses (e a entregar só com ordem judicial); o login (sessão) some ao sair ou ao trocar de aparelho |
| 2026-10-01 | **Baixar meus dados**: um arquivo JSON (chaves em português) com a conta, aceites, dispositivos, matrículas, progresso, respostas, simulados, compras e afiliado — sem senha nem tokens | Direito de acesso e portabilidade (art. 18) sem trabalho manual do suporte |
| 2026-10-01 | **Sentry** só com o DSN configurado; sem dados pessoais: sem `sendDefaultPii`, sem cookies, corpo de formulário ou parâmetros de endereço, e e-mails/CPFs apagados das mensagens (inclusive dos dados extras de um `console.error` capturado — *revisão da Fase 7*). Sem gravação de tela nem medição de desempenho (por enquanto). Erros do servidor que só iam para o log (`console.error`) também viram aviso | Saber que algo quebrou sem enviar dados de alunos para fora (e sem custo de plano maior) |
| 2026-10-01 | **PostHog** (análise de uso) só depois de o visitante clicar em "Aceitar análise" no aviso de cookies (cookie `ct_cookies`, 1 ano; "Preferências de cookies" no rodapé muda a escolha). Sem a chave, nem o aviso aparece. Sem gravação de tela e sem captura automática de cliques: só as páginas visitadas, **sem os `?parâmetros`** do endereço (*revisão da Fase 7*: o link de redefinir a senha leva um código secreto) | Cookie de análise não é essencial: a LGPD pede consentimento; menos dados coletados = menos risco |
| 2026-10-01 | **Cabeçalhos de segurança** em todas as páginas: não pode ser aberto dentro de `<iframe>` de outro site, HTTPS obrigatório (HSTS), sem "adivinhar" tipo de arquivo, endereço de origem reduzido e câmera/microfone desligados. Previews da Vercel com `noindex` e `robots.txt` bloqueando tudo | Proteção contra "clickjacking" e vazamentos simples; o Google não indexa os sites de teste |
| 2026-10-01 | **Tarefas agendadas** (Vercel Cron, protegidas pelo `CRON_SECRET`): de hora em hora, **conferir no Asaas** as cobranças em aberto dos últimos 90 dias (até 25 por vez, cada uma no máximo 1 vez por hora; vencida há mais de 7 dias, 1 vez por dia — *revisões da Fase 7*; para de começar conferências aos 20 s, dentro do limite de 60 s da função); todo dia, **limpar** logins e códigos vencidos. `/api/health` para o monitor de disponibilidade | Um aviso do Asaas perdido não deixa mais o aluno sem acesso até alguém clicar em "Conferir"; o banco não acumula lixo |
| 2026-10-01 | **Migrações automáticas só no deploy de produção** (`scripts/vercel-build.sh`: `prisma migrate deploy` antes do `next build`); previews só migram com `MIGRATE_ON_PREVIEW=true` (banco próprio por preview, integração Neon). Mudança que apaga/renomeia coluna vai em duas entregas | A migração manual deixava um intervalo com código novo e banco velho; o build só vai ao ar se a migração passar |
| 2026-10-01 | Previews da Vercel usam o **próprio endereço** (`VERCEL_BRANCH_URL`/`VERCEL_URL`) como `BETTER_AUTH_URL` | O login em previews mandava para o site oficial |
| 2026-10-01 | **Testes E2E** (Playwright) no repositório, contra o site em modo desenvolvimento (pagamento **simulado**), rodando no CI com o seed num banco descartável | Garante os caminhos mais importantes (cadastro, LGPD, compra, reembolso, celular) a cada PR, sem conta no Asaas |
| 2026-10-01 | Dados da empresa nos textos legais pelas variáveis `LEGAL_*`, **obrigatórias** no site oficial; os textos atuais são **modelos** a revisar com um advogado | A LGPD exige identificar o controlador e o canal do encarregado; o site oficial não sobe com "[CNPJ]" |
| 2026-10-02 | **Fase 8 — trilha = roteiro, não produto:** uma trilha (`tracks`) é um roteiro de estudo por concurso/banca, em **etapas**, cada uma com **aulas de qualquer curso** (o Curso Base + aulas próprias) e **treinos de questões** (assunto + banca opcional + meta). Ela **não libera nada**: o cadeado de cada aula vem da mesma regra das páginas do curso (`checkLessonAccess` com a matrícula no curso DAQUELA aula); para vender, a trilha aponta um produto/plano (como as páginas de concurso) | Reaproveita as aulas sem duplicar cursos e sem mexer na regra de acesso (o código mais sensível); "trilha direcionada" = ordem + foco, que é o diferencial |
| 2026-10-02 | Progresso na trilha: aula **feita** = concluída; treino **feito** = respondeu a meta de questões **diferentes** do assunto (na banca do treino, se houver), na prática ou em simulados. "Próximo passo" = o primeiro não feito. Aula ou curso em rascunho: o aluno não vê o passo (o professor vê, com aviso) | Medida simples e honesta: repetir a mesma questão não completa o treino; a trilha mostra o que falta |
| 2026-10-02 | **"Montar pelo que mais cai"**: ao criar a trilha (ou numa trilha vazia), uma etapa por assunto da banca, do que mais cai para o que menos cai (questões de prova publicadas), com as aulas daquele assunto (uma aula não se repete) e um treino na banca (meta 10). O professor revisa depois (ordem, dicas, metas, incluir/tirar). A página mostra, ao vivo, quanto cada etapa cai na banca | É o diferencial do produto ("estudar primeiro o que dá mais pontos") virando rotina de uma tela só |
| 2026-10-02 | **Aula ↔ assunto** (`lesson_subjects`, marcado no painel da aula): depois de responder uma questão, "estude esta aula" (até 2 aulas publicadas do assunto); na página da aula, "treinar questões deste assunto"; em "Meu desempenho", a aula de cada ponto fraco | Liga a prática à teoria (pendência da Fase 5) com uma tabela só, usada também pelo "montar pelo que mais cai" |
| 2026-10-02 | Estrutura da trilha editada com a trava da trilha (`track:<id>`); uma aula entra no máximo **uma vez** por trilha; aula, curso, assunto ou banca usados numa trilha **não se apagam** (chave estrangeira `Restrict` + aviso no painel); trocar o endereço da trilha redireciona o antigo; a página de concurso pode indicar uma trilha ("Seguir a trilha", só se publicada) | Mesmas regras de sempre: nada some sem o professor ver, posições nunca se embaralham, links antigos continuam valendo |

## 9. Contas que precisam ser criadas (antes/durante a Fase 1)

- [x] GitHub vinculado ao Claude (claude.ai → Settings → Connectors) para commits no repositório
- [ ] Neon (banco PostgreSQL) — criar também uma branch `test` para os testes de integração
- [ ] Vercel (hospedagem, conectada ao repositório)
- [ ] Google Cloud Console (login com Google) — pode ficar para o fim da Fase 1
- [ ] Resend (e-mails) — Fase 1
- [ ] Panda Video — Fase 3
- [ ] Cloudflare (R2) — Fase 3
- [ ] Asaas (conta sandbox para testes; depois a de produção) — Fase 4 (código pronto, falta a conta)
- [ ] Sentry (avisos de erro) e PostHog (análise, opcional) — Fase 7 (código pronto, falta a conta)
- [ ] Monitor de disponibilidade (ex.: UptimeRobot) apontando para `/api/health` — Fase 7

> Nunca colar senhas ou chaves de API no chat. Elas vão só no arquivo `.env.local`
> (que não sobe para o GitHub) e nas variáveis de ambiente da Vercel.

## 10. Histórico de entregas

### Fase 1 — Setup, banco, autenticação e perfis (2026-09-28)

**Entregue:**
- Projeto Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui, organizado em módulos (`src/modules/auth`, `src/modules/email`).
- Banco: `prisma/schema.prisma` com `users` (com `role`), `sessions`, `accounts`, `verifications`, `rate_limits`; migração inicial.
- Variáveis de ambiente validadas com Zod ao iniciar (`src/lib/env.ts`), modelo em `.env.example`.
- Autenticação (Better Auth): e-mail/senha, link mágico por e-mail, Google (liga sozinho quando as chaves existem),
  verificação de e-mail, "esqueci minha senha", proteção contra força bruta.
- Perfis `STUDENT`/`TEACHER`/`ADMIN`, proteção de páginas (`proxy.ts` + `requireSession`/`requireRole`), script `user:set-role`.
- Limite de 2 dispositivos, com lista "Dispositivos conectados" e botão para desconectar.
- Páginas: início (provisória), entrar, cadastro, esqueci/redefinir senha, área do aluno, painel admin, termos e privacidade (provisórios).
- Testes: 46 unitários + 8 de integração; CI no GitHub Actions (lint, tipos, testes, build).
- Revisão de código feita no PR [#1](https://github.com/felipeyamate/site_concurso_ti/pull/1): 10 achados, todos corrigidos (detalhes no PR).

**Como testar:** [README.md → "Como testar a Fase 1"](./README.md#2-como-testar-a-fase-1-passo-a-passo).

**Decisão tomada na revisão:** a confirmação de e-mail continua **opcional** (um extra, não é exigida para entrar).
Os efeitos colaterais foram tratados na própria Fase 1: aviso "Sua conta não tem senha" com atalho para criar uma, e mensagem
explicando o erro do Google para contas não confirmadas.

**Pendências conhecidas (não bloqueiam a Fase 2):**
- Textos definitivos de Termos e Privacidade + registro formal de consentimento (LGPD) → Fase 7. (*Feito na Fase 7; falta a revisão de um advogado.*)
- Exclusão de conta pelo próprio aluno (LGPD) → Fase 7. (*Feito na Fase 7.*)
- Deploys de preview da Vercel: `BETTER_AUTH_URL` aponta para um endereço fixo; login em previews exigirá ajuste → Fase 7. (*Resolvido na Fase 7.*)
- `npm audit` aponta alertas em dependências internas do CLI do Prisma (usado só em desenvolvimento, não vai para o site). Acompanhar atualizações do Prisma.

### Fase 2 — Catálogo, área do aluno, player e progresso (2026-09-28)

**Entregue:**
- Banco: `courses`, `modules`, `lessons`, `enrollments` e `lesson_progress` (migração `catalog_enrollments_progress`).
- Catálogo público (`/cursos`) e página do curso (`/cursos/<curso>`) com a grade, duração, aulas grátis e cadeados.
- Página da aula com player, marca d'água com o e-mail, "continuar de onde parou", concluir/desmarcar, anterior/próxima e grade lateral com ✓.
- Regra de acesso única (`checkLessonAccess`): matrícula ativa, vencida, revogada, aula grátis, rascunho, professor/admin.
- Área do aluno: "Meus cursos" com % concluído e botão "Continuar".
- Seed de exemplo (`npm run db:seed`: Curso Base com 16 aulas + 1 curso em rascunho) e script de matrícula (`npm run enroll`).
- Provedor de vídeo de desenvolvimento, atrás da interface que receberá o Panda.
- Testes: 94 unitários + 24 de integração; 47 cenários no navegador (incluindo celular de 360 px), além dos 39 da Fase 1.
- Revisão de código antes do PR: 12 achados (2 meus + 10 da revisão formal), todos corrigidos e cobertos por testes.
- Segunda revisão (no PR [#2](https://github.com/felipeyamate/site_concurso_ti/pull/2)): mais 10 achados, todos corrigidos — o principal: só **abrir** uma aula (em modo de desenvolvimento) zerava a posição salva do "continuar de onde parou".

**Como testar:** [README.md → "Como testar a Fase 2"](./README.md#3-como-testar-a-fase-2-passo-a-passo).

**Pendências conhecidas (não bloqueiam a Fase 3):**
- A conclusão olha a **posição** no vídeo, não o tempo realmente assistido (pular para o fim conclui). Rever se virar problema.
- Progresso do player do Panda (dentro de um `<iframe>`) depende das mensagens do player deles → Fase 3.
- Vitrine pública (`/cursos`) é montada a cada acesso; cache e SEO próprios na Fase 6. (*SEO feito na Fase 6; o cache continua pendente — ver a Fase 7.*)
- A nossa marca d'água fica por cima do player e **não aparece em tela cheia**; a proteção principal será a do Panda (dentro do vídeo), na Fase 3.
- `npm run build && npm start` na sua máquina bloqueia o vídeo de exemplo (é "produção"); para testar, use `npm run dev`.

### Fase 3 — Painel admin, Panda Video e PDFs (2026-09-29)

**Entregue:**
- Banco: tabela `lesson_attachments` (PDFs das aulas) e coluna `video_embed_url` nas aulas (migração `lesson_attachments_panda`).
- Painel `/admin` com menu: visão geral (situação das integrações Panda/R2, sem mostrar chaves), **Cursos** e **Usuários**.
- Cursos (professor ou admin): criar (rascunho), editar dados/endereço, publicar, reordenar; módulos (criar, renomear, ↑↓, apagar vazio);
  aulas (criar, editar, mover de módulo, ↑↓, grátis/publicada, apagar com proteção do histórico).
- Vídeo da aula: Panda Video (colar link/código `<iframe>` ou escolher da biblioteca pela API), sem vídeo, ou o exemplo (só desenvolvimento).
- Player do Panda: marca d'água DRM (JWT assinado, 6 h), progresso e "continuar de onde parou" pelas mensagens do player.
- PDFs: envio direto para o Cloudflare R2 (ou pasta local em desenvolvimento), lista "Material da aula" para quem tem acesso e download
  com link temporário depois de checar o acesso.
- Usuários (só admin): busca, troca de perfil com travas, matrícula manual (criar/renovar/revogar) com a mesma regra do script.
- Testes: 155 unitários + 45 de integração; 48 cenários novos no navegador (inclusive um player falso do Panda para testar as mensagens)
  e os 47 da Fase 2 repetidos sem regressão.
- Revisão de código no PR [#3](https://github.com/felipeyamate/site_concurso_ti/pull/3): 10 achados, todos corrigidos — os principais no progresso
  do Panda (ver decisões de 2026-09-29) — além de 3 problemas achados nos testes no navegador (player recarregando ao concluir a aula,
  "continuar de onde parou" perdido se o player carregasse antes da página, tabelas vazando no celular).
- Segunda revisão (antes do merge): mais 10 achados, todos corrigidos — os principais: pedidos **simultâneos** (duas renovações somavam
  só uma; apagar uma aula no instante em que um aluno salvava progresso levava o progresso junto) e o link de envio de PDF, que podia
  ser reusado depois da confirmação (e o tipo do arquivo não entrava na assinatura do R2). Os dois casos simultâneos têm testes que
  falham sem a correção.

**Como testar:** [README.md → "Como testar a Fase 3"](./README.md#4-como-testar-a-fase-3-passo-a-passo).

**Pendências conhecidas (não bloqueiam a Fase 4):**
- **Conferir com uma conta real do Panda** (o ambiente do Claude não acessa o Panda): nomes exatos dos eventos do player, o comando de
  pular (`currentTime`) e a marca d'água DRM. Tudo foi feito pela documentação pública; ajustes ficam em `src/modules/video/panda/`.
- Criar as contas do Panda e do Cloudflare R2 e cadastrar as variáveis (seção 9 e README). Configurar no Panda os domínios permitidos.
- Um PDF enviado mas não confirmado (ex.: aba fechada no meio) fica "órfão" no R2 (invisível para alunos). Limpeza automática → Fase 7. (*Continua pendente: ver a Fase 7.*)
- Trocar o endereço (slug) de um curso/aula publicado quebra links antigos; redirecionamento automático → Fase 6 (SEO). (*Resolvido na Fase 6.*)
- O seed de exemplo sincroniza o curso de exemplo: não use o curso do seed para conteúdo real.

### Fase 4 — Vendas: checkout (Asaas), webhooks, assinaturas, reembolso e NFS-e (2026-09-29)

**Entregue:**
- Banco: `products`, `product_courses`, `plans`, `billing_profiles`, `orders`, `order_courses`, `subscriptions`, `payments`,
  `webhook_events` e `fiscal_invoices`; matrícula com a origem na chave única (migração `sales_payments`, com travas `CHECK` nos valores).
- Módulo `src/modules/payments`: interface `PaymentProvider` com o **Asaas** (API v3) e um provedor **FAKE** para desenvolvimento,
  checkout (compra avulsa em Pix, boleto ou cartão parcelado) e assinatura (mensal/anual), recebimento de avisos (`/api/webhooks/asaas`),
  recálculo do acesso pago (`syncPaidAccess`), reembolso e cancelamento, nota fiscal opcional.
- Páginas do aluno: ofertas na página do curso, `/planos`, `/comprar/<produto>`, `/assinar/<plano>`, página do pagamento (QR Pix, boleto,
  link do cartão, atualização automática) e "Minhas compras" (pedir reembolso em 7 dias, cancelar assinatura).
- Painel `/admin/vendas` (só ADMIN): resumo, produtos, planos (com os cursos inclusos), pedidos, assinaturas e avisos recebidos —
  reembolsar, cancelar, conferir no Asaas, reprocessar aviso e tentar a nota de novo. A ficha do usuário mostra as compras.
- Simulador de pagamentos em desenvolvimento (`/dev/pagamentos/...`): pagar, vencer, estornar, negar estorno, chargeback e próximo ciclo.
- E-mails de compra confirmada e de reembolso pedido.
- Testes: 243 unitários + 78 de integração; 55 cenários novos no navegador (inclusive celular de 360 px) e os da Fase 2 e da Fase 3
  repetidos sem regressão.
- Revisão de código no PR [#4](https://github.com/felipeyamate/site_concurso_ti/pull/4): 10 achados, todos corrigidos (ver decisões de
  2026-09-30) — os principais: o "Conferir no Asaas" desfazia um reembolso de boleto; duplo clique gerava dois estornos ou duas
  assinaturas; uma falha do provedor no meio do cancelamento fazia o aluno perder o reembolso; estorno negado ficava sem nota fiscal.
  Os casos principais têm testes que falham sem a correção.
- Segunda revisão (antes do merge): mais 10 achados, todos corrigidos — os principais: assinatura "órfã" que continuava existindo no
  Asaas depois de um erro na criação; repetir "cancelar e estornar" estornava um segundo ciclo; estorno de boleto de assinatura sem
  aviso no painel; a resposta do Asaas a um estorno descartada por diferença de relógio. 7 testes novos falham sem as correções.

**Como testar:** [README.md → "Como testar a Fase 4"](./README.md#5-como-testar-a-fase-4-passo-a-passo).

**Pendências conhecidas (não bloqueiam a Fase 5):**
- **Conferir com o sandbox real do Asaas** (o ambiente do Claude não acessa o Asaas): formato dos avisos, domínio do retorno do cartão
  (precisa estar cadastrado na conta), QR code do Pix, cobrança automática da assinatura no cartão e a emissão da NFS-e. Tudo foi feito
  pela documentação pública; ajustes ficam em `src/modules/payments/provider/asaas/`.
- Criar a conta do Asaas (sandbox e depois produção), cadastrar o aviso (webhook) com o token e combinar a NFS-e com o contador (seção 9 e README).
- Aviso perdido (o Asaas desistiu de enviar): hoje o admin usa "Conferir no Asaas" no pedido; conferência automática periódica → Fase 7. (*Feito na Fase 7: de hora em hora.*)
- Trocar de plano (mensal ↔ anual) não é automático: o aluno cancela e assina o outro.
- Estorno de boleto pendente não tem botão de "desistir" no painel: se o admin decidir não devolver, o acesso volta com uma
  matrícula manual. Rever se acontecer.
- Recalcular todos os assinantes (ao mudar os cursos da assinatura) roda um aluno por vez dentro da ação do painel; com milhares
  de assinantes, passar para uma tarefa em segundo plano → Fase 7. (*Continua pendente: ver a Fase 7.*)
- Reembolso, cancelamento e checkout seguram uma conexão do banco durante a chamada ao Asaas (até 15 s), por causa da trava. Com
  muito movimento ao mesmo tempo, rever o tamanho do "pool" de conexões → Fase 7. (*Continua pendente: ver a Fase 7.*)
- Cupons de desconto e afiliados → Fase 6. (*Feito na Fase 6.*)
- Exclusão de conta (LGPD) de quem tem compras: os registros fiscais precisam ficar (anonimizar em vez de apagar) → Fase 7. (*Feito na Fase 7.*)
- Aviso do `pg` nos testes ("client.query() when the client is already executing a query") vem de dentro do adaptador do Prisma; não
  afeta o resultado. Acompanhar atualizações do Prisma.
- Os testes no navegador deixam pedidos simulados no banco de desenvolvimento (apague com um banco novo se incomodar).

### Fase 5 — Banco de questões, simulados e "o que mais cai" (2026-09-30)

**Entregue:**
- Banco: `boards`, `subjects`, `exams`, `questions`, `question_options`, `question_attempts`, `mock_exams` e
  `mock_exam_questions` (migração `question_bank`, com travas `CHECK` no gabarito, nas letras e na origem da resposta).
- Módulo `src/modules/questions`: regra de acesso (10 grátis por dia ou acesso completo com matrícula), respostas e
  correção, sorteio e nota do simulado, desempenho por assunto, mapa de incidência e importação por CSV — as regras em
  arquivos "puros" testados, o banco nos `*.server.ts`.
- Aluno: **Resolver questões** (`/questoes`, filtros por assunto, banca, prova, tipo e "não respondidas"/"que errei";
  gabarito e comentário depois de responder), **Simulados** (`/simulados`, com ou sem tempo, salva a cada clique,
  resultado com a correção e os acertos por assunto), **Meu desempenho** (`/area-do-aluno/desempenho`, pontos fracos)
  e o mapa público **O que mais cai** (`/o-que-mais-cai`, geral e por banca).
- Painel `/admin/questoes` (professor ou admin): lista com filtros, criar/editar/publicar/apagar questão (com a proteção
  do histórico), bancas/assuntos/provas e **importação por planilha** (com modelo para baixar).
- Seed: 4 bancas, 6 assuntos, 3 provas fictícias e 30 questões comentadas de exemplo.
- Testes: 287 unitários + 103 de integração; 57 cenários novos no navegador (inclusive celular de 360 px), mais 18 das
  correções das revisões, e os das Fases 2, 3 e 4 repetidos sem regressão (36 + 48 + 55).
- Os testes no navegador acharam 2 problemas, corrigidos: a tela de resultado do simulado quebrava (o servidor chamava
  uma função de um componente do navegador) e o modelo de planilha usava um assunto que não existe no seed
  (agora um teste importa o próprio modelo).
- Revisão de código no PR [#5](https://github.com/felipeyamate/site_concurso_ti/pull/5): 10 achados, todos corrigidos — os
  principais: resposta no instante da troca do gabarito era corrigida com o gabarito antigo; teste do professor travava a
  questão; quem perdia o acesso ainda finalizava simulados abertos (e via os gabaritos); relógio do simulado dependia do
  relógio do aparelho; planilha acima de 1 MB dava erro genérico. Os casos principais têm testes que falham sem a correção.
- Segunda revisão (antes do merge): mais 10 achados, todos corrigidos — os principais: responder em "Resolver questões" uma
  questão do próprio simulado aberto entregava o gabarito; planilha do Excel em português (Windows-1252) estragava os
  acentos; o "Voltar" do navegador devolvia minutos ao relógio do simulado; questão gravada durante a troca de banca da
  prova ficava com a banca antiga; a cota grátis contava respostas de simulado. 5 testes novos falham sem as correções.

**Como testar:** [README.md → "Como testar a Fase 5"](./README.md#6-como-testar-a-fase-5-passo-a-passo).

**Pendências conhecidas (não bloqueiam a Fase 6):**
- Questões só com **texto** (sem imagem, tabela ou fórmula formatada). Questões de Office com print de tela → rever quando
  o professor precisar (upload de imagem pelo mesmo armazenamento dos PDFs).
- O aluno não tem botão para **avisar erro** numa questão, e não existe a marca de questão **anulada** pela banca.
- O assunto da questão não aponta para a **aula** que ensina aquilo ("estude esta aula") → junto com as trilhas. (*Feito na Fase 8.*)
- O mapa "o que mais cai" só fica representativo quando houver provas reais cadastradas (as do seed são fictícias).
- Simulado em andamento que o aluno abandona fica "em andamento" (conta no limite de 3 até ele finalizar), e as questões dele
  ficam fora de "Resolver questões" até lá — inclusive para quem perdeu o acesso (não finaliza até o acesso voltar). Rever se incomodar.
- Os testes no navegador deixam alunos, respostas e simulados no banco de desenvolvimento (apague com um banco novo se incomodar).

### Fase 6 — Marketing: páginas de concurso, blog, SEO, cupons e afiliados (2026-09-30)

**Entregue:**
- Banco: `coupons` (+ produtos/planos), `affiliates`, `affiliate_click_days`, `affiliate_payouts` (+ itens), `exam_notices`
  (+ assuntos), `blog_posts` e `slug_redirects`; pedido e assinatura com cupom, desconto, afiliado e taxa da comissão
  (migração `marketing`, com travas `CHECK` nos códigos e valores).
- **Cupons** (`src/modules/coupons`): regras puras testadas, campo "Tem um cupom?" na compra e na assinatura (e `?cupom=` no
  link), conferência com trava no checkout, painel `/admin/vendas/cupons` e o cupom em "Minhas compras" e na ficha do pedido.
- **Afiliados** (`src/modules/affiliates`): link `/r/<codigo>`, cookie, venda indicada, comissões (carência, estorno), área do
  afiliado (`/area-do-aluno/afiliado`: link com destino, cliques, vendas, comissões e chave Pix) e painel
  `/admin/vendas/afiliados` (cadastro, taxa, comissões e registro do pagamento).
- **Blog** (`/blog`, `/blog/<post>`, `/blog/rss.xml`) e **páginas de concurso** (`/concursos`, `/concursos/<pagina>`), com o
  painel "Conteúdo do site" (`/admin/conteudo`, PROFESSOR ou mais) e Markdown com prévia.
- **SEO** (`src/modules/seo`): canonical, OpenGraph, sitemap, robots, JSON-LD, RSS e redirecionamento de endereços antigos
  (cursos, aulas, posts e concursos). Página inicial nova, com os concursos abertos e os últimos posts.
- Seed: 3 posts de exemplo e 1 página de concurso **fictícia**.
- Testes: 328 unitários + 130 de integração (inclusive um cupom disputado por duas compras ao mesmo tempo, que falha sem a
  trava); 89 cenários novos no navegador (inclusive celular de 360 px) e os das Fases 2, 3, 4 e 5 repetidos sem
  regressão (36 + 48 + 55 + 57).
- Os testes no navegador acharam 1 problema, corrigido: botões com texto longo (na página de concurso, no post com
  assunto e no "Registrar pagamento") não quebravam a linha e alargavam a página no celular.
- Revisão de código no PR [#6](https://github.com/felipeyamate/site_concurso_ti/pull/6): 10 achados, todos corrigidos (ver
  decisões de 2026-09-30) — os principais: um Pix não pago travava o cupom; a página de concurso prometia um cupom que não
  valia para a oferta; o professor conseguia "adivinhar" cupons; o endereço antigo de um rascunho revelava o novo; editar o
  cupom não esperava uma compra em andamento; título do blog terminado em "#" (C#) perdia o caractere; comissões como
  "0,29%" eram recusadas; as listas de cupons e afiliados faziam uma consulta por item. O caso da trava tem um teste que
  falha sem a correção.
- Segunda revisão (antes do merge): mais 10 achados, todos corrigidos — os principais: o último uso de um cupom de
  assinatura podia ir para dois alunos; apagar um produto transformava um cupom restrito em cupom para tudo; o registro de
  pagamento ao afiliado podia incluir comissões que o admin não viu (nem pagou); renomear um cupom quebrava a página de
  concurso; link "/\\site" no Markdown saía do site; a página de concurso montava o mapa de incidência inteiro a cada
  acesso. 3 testes novos falham sem as correções.

**Como testar:** [README.md → "Como testar a Fase 6"](./README.md#7-como-testar-a-fase-6-passo-a-passo).

**Pendências conhecidas (não bloqueiam a Fase 7):**
- O pagamento ao afiliado é manual (Pix fora do site); split automático pelo Asaas → rever se o programa crescer.
- Cupom "só no primeiro mês" da assinatura não existe (o desconto vale em todas as renovações).
- Pedido **aguardando pagamento** reserva o uso do cupom (até vencer: 1 dia no Pix/cartão, 3 no boleto): quem gerou um Pix
  com o cupom e quer pagar com boleto paga o pedido já gerado ou espera vencer. Um boleto vencido pago mesmo assim volta a
  contar — nesse caso raro, o limite total do cupom pode passar em 1.
- Sem imagem de compartilhamento (OpenGraph) própria por página, nem imagens dentro dos posts.
- Páginas públicas sem cache (ver decisões); o `robots.txt` é gerado no build com o `BETTER_AUTH_URL` da época.
- Os testes no navegador deixam cupons, afiliados, posts e páginas de teste no banco de desenvolvimento.

### Fase 7 — LGPD, avisos de erro, análise de uso, testes E2E e produção (2026-10-01)

**Entregue:**
- Banco: `legal_consents` (aceites) e `access_logs` (registro de acesso do Marco Civil); `users` com `legal_version` e
  `deleted_at`; `payments` com `provider_checked_at` (migrações `privacy_production` e `access_logs`).
- **LGPD** (`src/modules/legal`, `src/modules/privacy`): Termos de uso e Política de privacidade completos (modelos a revisar
  com um advogado, com os dados da empresa pelas variáveis `LEGAL_*`), com versão; aceite obrigatório no cadastro e tela
  `/aceitar-termos` quando a versão muda; **Minha conta e privacidade** (`/area-do-aluno/conta`: nome, aceites, **Baixar meus
  dados** em JSON e **Excluir minha conta**, que anonimiza e guarda os registros fiscais); exclusão pelo painel (ADMIN).
- **Registro de acesso** (Marco Civil): cada login guardado por 6 meses e apagado depois pela limpeza diária.
- **Sentry** (`src/instrumentation*.ts`, `src/lib/observability`): servidor e navegador, só com o DSN, sem dados pessoais; páginas
  "Algo deu errado" (`error.tsx`, `global-error.tsx`).
- **PostHog** (`src/modules/analytics`): aviso de cookies e análise só depois do "Aceitar análise"; "Preferências de cookies" no rodapé.
- **Produção:** cabeçalhos de segurança (`next.config.ts`); `/api/health`; tarefas agendadas (`vercel.json` + `/api/cron/...` com
  `CRON_SECRET`): conferir pagamentos em aberto no Asaas de hora em hora e limpeza diária; previews com o próprio endereço e fora
  do Google; migrações automáticas só no deploy de produção (`scripts/vercel-build.sh`); guia de publicação completo no README.
- **Testes E2E no repositório** (`tests/e2e/`, Playwright, `npm run test:e2e`) e no CI (job `e2e`, com o seed num banco descartável).
- Testes: 350 unitários + 149 de integração + 12 cenários E2E no repositório (cadastro com aceite, aceite de versão nova, baixar
  dados, excluir conta, compra com Pix simulado e reembolso, cupom, páginas públicas, SEO/cabeçalhos/tarefas, questão grátis,
  afiliado, painel fechado para alunos e celular de 360 px).
- Os testes E2E acharam 1 problema, corrigido: um e-mail comprido (sem onde quebrar a linha) alargava a área do aluno no
  celular; agora o e-mail quebra (`break-all`) na área do aluno, na conta e na ficha do usuário no painel.
- Segunda revisão (antes do merge): mais 9 achados, todos corrigidos — os principais: um link de "redefinir senha" pedido antes
  da exclusão permitia entrar de novo na conta excluída; um reembolso no mesmo instante da exclusão não era visto; Pix/cartão
  vencidos (que o site ainda deixa pagar) saíam da conferência automática e não impediam a exclusão; as janelas de dias não
  usavam o dia de Brasília; a ação de compra não conferia o aceite dos textos novos. 2 testes novos falham sem as correções.
- Revisão de código no PR [#7](https://github.com/felipeyamate/site_concurso_ti/pull/7): 10 achados, 9 corrigidos e 1 que não se
  confirmou (aviso duplicado no Sentry: testado com um Sentry falso, sai 1 aviso por erro). Os principais: o PostHog guardaria o
  endereço com o código secreto do "redefinir senha"; os dados extras de um erro capturado iam ao Sentry com e-mail/CPF; um boleto
  vencido (que ainda pode ser pago) ou um reembolso em andamento não impediam a exclusão da conta; quem não aceitou os textos novos
  não conseguia cancelar a assinatura para excluir a conta; recusar os cookies durante o carregamento do PostHog não impedia que
  ele ligasse; Pix abandonados ocupariam a conferência automática. Os casos principais têm testes novos.

**Como testar:** [README.md → "Como testar a Fase 7"](./README.md#8-como-testar-a-fase-7-passo-a-passo).
**Publicar:** [README.md → "Publicando o site"](./README.md#13-publicando-o-site-produção-na-vercel).

**Pendências conhecidas:**
- **Revisão jurídica** dos Termos e da Política de privacidade (os textos são modelos) e preenchimento dos dados reais (`LEGAL_*`).
  Conferir com o advogado se o registro de acesso precisa também da **porta de origem** (IPs compartilhados de operadoras).
- Criar as contas do Sentry (e, se quiser, PostHog) e o monitor de disponibilidade; plano **Pro** da Vercel para as tarefas de hora em hora.
- `Content-Security-Policy` completa (lista de scripts/imagens/iframes permitidos) — hoje só `frame-ancestors`; exige testar com o
  Panda, o Asaas, o Sentry e o PostHog de verdade.
- Páginas públicas continuam **sem cache** (montadas a cada acesso) → ativar quando o movimento pedir.
- PDF "órfão" (envio não confirmado) continua no R2; limpeza automática → quando o volume justificar.
- Recalcular todos os assinantes ao mudar os cursos da assinatura roda dentro da ação do painel; com milhares de assinantes,
  passar para uma tarefa em segundo plano.
- Reembolso, cancelamento e checkout seguram uma conexão do banco durante a chamada ao Asaas: acompanhar o "pool" de conexões
  da Neon com movimento real.
- Nos testes E2E, o pagamento é sempre **simulado**; a conferência com o sandbox real do Asaas continua pendente (Fase 4).
- Os testes E2E deixam contas `e2e-...@exemplo.com` (e produtos/cupons de teste) no banco de desenvolvimento.

### Fase 8 — Trilhas de estudo por concurso/banca e "estude esta aula" (2026-10-02)

**Entregue:**
- Banco: `tracks`, `track_sections`, `track_items` (aula OU treino, com travas `CHECK`), `lesson_subjects` e `exam_notices.track_id`
  (migração `study_tracks`); endereço antigo de trilha redireciona (`SlugRedirectKind.TRACK`).
- **Trilhas** (`src/modules/tracks`): regras puras testadas (`rules.ts`: visão do aluno com acesso pela matrícula, feito/próximo
  passo, e o rascunho pelo "o que mais cai"), página pública `/trilhas` e `/trilhas/<trilha>` (etapas, cadeados, treinos
  filtrados, progresso com login, "Próximo passo", oferta e quanto cada etapa cai na banca), no menu, no rodapé, na página
  inicial e no sitemap.
- **Painel** (`/admin/conteudo/trilhas`, PROFESSOR ou mais): criar/editar/publicar/apagar, "montar pelo que mais cai", etapas
  e passos com ↑ ↓, editar (dica, meta, banca, mudar de etapa), incluir aula (de qualquer curso) e treino; proteções ao apagar
  aula, curso, assunto e banca usados numa trilha.
- **Aula ↔ assunto**: "Assuntos desta aula" no painel; "estude esta aula" depois de responder em "Resolver questões"; "treinar
  questões" na página da aula; a aula de cada ponto fraco em "Meu desempenho".
- **Página de concurso** indica a trilha ("Seguir a trilha"); os cartões de oferta viraram um componente só (`OfferCards`),
  usado pela página de concurso e pela trilha.
- Seed: os assuntos das aulas do Curso Base e a trilha **fictícia** "Exemplo — Trilha Cesgranrio (Banco)", indicada na
  página de concurso fictícia.
- Testes: 363 unitários + 160 de integração (inclusive passos incluídos **ao mesmo tempo** na mesma etapa) + 16 cenários E2E
  (4 novos das trilhas; o celular de 360 px agora passa também por `/trilhas` e pela trilha de exemplo). O painel de trilhas,
  a aula no painel e "Meu desempenho" foram conferidos a 360 px (sem rolagem lateral).

**Como testar:** [README.md → "Como testar a Fase 8"](./README.md#9-como-testar-a-fase-8-passo-a-passo).

**Pendências conhecidas:**
- Trilha com **prazo** (ex.: "faltam 45 dias para a prova: estude X por semana") e lembretes por e-mail → quando houver alunos
  usando as trilhas.
- "Minhas trilhas" na área do aluno (hoje o aluno chega pela lista, pela página de concurso ou pelo link) → rever com uso real.
- O "montar pelo que mais cai" usa as questões de **prova** da banca: com as provas fictícias do seed, a ordem é só um exemplo.
- Simulado "da trilha" (sortear só os assuntos da trilha na banca dela) → junto com o prazo.
- Os testes E2E deixam trilhas `Trilha E2E ...` no banco de desenvolvimento.

