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
Question >── Subject (assunto), Board (banca), Exam (concurso/ano)
Coupon, Affiliate, WebhookEvent (log de tudo que chega dos provedores)
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
| 2 | Catálogo, área do aluno, player, progresso | ⏳ próxima |
| 3 | Admin: CRUD de cursos, upload de vídeos (Panda) e PDFs (R2) | — |
| 4 | Checkout (Asaas), webhooks, matrículas, assinaturas, reembolso, NFS-e | — |
| 5 | Banco de questões, simulados, mapa de incidência por banca | — |
| 6 | Landing pages por edital, SEO, blog, cupons e afiliados | — |
| 7 | Testes E2E, Sentry, LGPD, deploy de produção | — |

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
| 2026-09-28 | Migrações de produção aplicadas manualmente (`npm run db:deploy`), não no deploy automático | Evita que um deploy de preview altere o banco de produção. Reavaliar na Fase 7 |
| 2026-09-28 | Testes de integração exigem banco separado (`TEST_DATABASE_URL`, ex.: branch `test` na Neon); CI no GitHub Actions com Postgres temporário | Os testes apagam dados; nunca podem rodar no banco do app |
| 2026-09-28 | Componentes shadcn/ui copiados à mão nesta fase (estilo new-york) | O ambiente do Claude bloqueia `ui.shadcn.com`. Na sua máquina, `npx shadcn@latest add <componente>` funciona normalmente com o `components.json` |
| 2026-09-28 | Páginas do servidor só **leem** a sessão; a renovação diária é feita pelo navegador (`SessionRefresher` nos layouts das áreas logadas) | Encontrado na revisão: renovar durante a renderização estendia o banco mas não o cookie, e o aluno era deslogado em 7 dias mesmo usando o site |
| 2026-09-28 | Quem se cadastra pelo link mágico ganha um nome provisório tirado do e-mail (`maria.silva@...` → "Maria Silva") | O link mágico não pede nome; sem isso a conta ficava com nome vazio |
| 2026-09-28 | Mantida a proteção do Better Auth: entrar pelo link mágico numa conta com e-mail **não confirmado** apaga a senha antiga e desloga os outros dispositivos. A área do aluno avisa "Sua conta não tem senha" e "Esqueci minha senha" cria uma nova | Impede o golpe de alguém se cadastrar antes com o e-mail de outra pessoa. Efeito colateral aceito de não exigir confirmação de e-mail |
| 2026-09-28 | Em produção com Resend, `EMAIL_FROM` com `@resend.dev` impede o app de iniciar | Esse remetente de teste só entrega para o dono da conta do Resend; os alunos não receberiam nada |

## 9. Contas que precisam ser criadas (antes/durante a Fase 1)

- [x] GitHub vinculado ao Claude (claude.ai → Settings → Connectors) para commits no repositório
- [ ] Neon (banco PostgreSQL) — criar também uma branch `test` para os testes de integração
- [ ] Vercel (hospedagem, conectada ao repositório)
- [ ] Google Cloud Console (login com Google) — pode ficar para o fim da Fase 1
- [ ] Resend (e-mails) — Fase 1
- [ ] Panda Video — Fase 3
- [ ] Cloudflare (R2) — Fase 3
- [ ] Asaas (conta sandbox para testes) — Fase 4
- [ ] Sentry e PostHog — Fase 7

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
- Textos definitivos de Termos e Privacidade + registro formal de consentimento (LGPD) → Fase 7.
- Exclusão de conta pelo próprio aluno (LGPD) → Fase 7.
- Deploys de preview da Vercel: `BETTER_AUTH_URL` aponta para um endereço fixo; login em previews exigirá ajuste → Fase 7.
- `npm audit` aponta alertas em dependências internas do CLI do Prisma (usado só em desenvolvimento, não vai para o site). Acompanhar atualizações do Prisma.
