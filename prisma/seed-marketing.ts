/**
 * seed-marketing.ts — Conteúdo de EXEMPLO do marketing (Fase 6): posts do blog e uma página de
 * edital FICTÍCIA, para testar o blog, as páginas de concurso e o SEO sem cadastrar nada.
 *
 * Quem chama: `seed.ts` (`npm run db:seed`), depois do banco de questões (usa as bancas e os
 * assuntos de lá). Os testes de integração também.
 * Pode rodar várias vezes: só cria o que ainda não existe (pelo slug) e NUNCA altera o que já
 * existe — se você editou um post de exemplo no painel, a sua versão fica.
 *
 * Cupons e afiliados NÃO entram aqui: são configuração de vendas (painel → Vendas).
 */
import type { PrismaClient } from "../src/generated/prisma/client";

const DAY = 24 * 60 * 60 * 1000;

type SeedPost = { slug: string; title: string; excerpt: string; subject: string | null; body: string };

export const SEED_POSTS: SeedPost[] = [
  {
    slug: "o-que-e-phishing-e-por-que-cai-tanto",
    title: "O que é phishing e por que cai tanto em concurso",
    excerpt: "O golpe da mensagem falsa explicado em linguagem simples — e como as bancas cobram isso na prova.",
    subject: "seguranca-da-informacao",
    body: `**Phishing** é o golpe em que alguém se passa por uma empresa ou pessoa de confiança para "pescar" (em inglês, *fishing*) seus dados: senha, número do cartão, códigos de verificação.

## Como o golpe funciona

1. Você recebe uma mensagem que parece verdadeira (e-mail, SMS, WhatsApp).
2. Ela cria **urgência**: "sua conta será bloqueada hoje".
3. O link leva a um site falso, igualzinho ao original.
4. Você digita seus dados — e eles vão direto para o golpista.

## Por que a banca adora esse assunto

Porque é um tema do dia a dia e fácil de transformar em pegadinha. Fique atento às palavras:

- **Phishing**: engana a pessoa para ela entregar os dados.
- **Pharming**: redireciona o endereço do site (ex.: mexendo no DNS) sem a pessoa perceber.
- **Spam**: mensagem em massa não solicitada — nem sempre é golpe.

> Dica de prova: se a questão fala em "mensagem que se passa por instituição conhecida", a resposta costuma ser phishing.

## Como se proteger

- Desconfie de urgência e de ofertas boas demais.
- Confira o endereço do site antes de digitar qualquer coisa.
- Ative a verificação em duas etapas.

Quer treinar? Resolva as [questões de Segurança da Informação](/questoes?assunto=seguranca-da-informacao).`,
  },
  {
    slug: "firewall-antivirus-e-antispyware-qual-a-diferenca",
    title: "Firewall, antivírus e antispyware: qual a diferença?",
    excerpt: "Três proteções que as bancas adoram misturar. Entenda o que cada uma faz — e o que ela NÃO faz.",
    subject: "seguranca-da-informacao",
    body: `Muita questão erra de propósito a função de cada ferramenta. Vamos separar:

## Firewall

Controla o **tráfego da rede**: decide o que pode entrar e sair do computador (ou da rede) seguindo regras. Pense num porteiro que confere quem entra.

## Antivírus

Procura **programas maliciosos** (vírus, worms, cavalos de Troia) nos arquivos e na memória, e remove ou isola o que encontrar.

## Antispyware

Especializado em **programas espiões**, que coletam informações sem você saber (ex.: o que você digita).

> Pegadinha clássica: "o firewall remove vírus do computador" — **errado**. Firewall filtra tráfego; quem remove vírus é o antivírus.

Veja também [o que mais cai na sua banca](/o-que-mais-cai).`,
  },
  {
    slug: "como-estudar-informatica-para-concurso-sem-ser-de-ti",
    title: "Como estudar Informática para concurso sem ser de TI",
    excerpt: "Um roteiro prático para quem nunca estudou tecnologia: por onde começar e como não se perder.",
    subject: null,
    body: `Informática assusta quem não é da área, mas é uma das matérias em que dá para ganhar muitos pontos com pouco tempo — se você estudar do jeito certo.

## 1. Comece pelo que mais cai

Cada banca tem seus assuntos preferidos. Olhe o [mapa do que mais cai](/o-que-mais-cai) e comece pelo primeiro da lista.

## 2. Teoria curta, questões longas

Leia o básico do assunto e vá logo para as questões. É resolvendo que você aprende o **jeito** da banca perguntar.

## 3. Revise o que você errou

Use o filtro *Que errei* em [Resolver questões](/questoes): a lista diminui conforme você aprende.

## 4. Faça simulados

Perto da prova, treine com tempo, como no dia de verdade.`,
  },
];

/**
 * Grava o conteúdo de exemplo. Passos: (1) cada post, se o slug ainda não existe — já publicado,
 * com datas espaçadas; (2) a página de edital fictícia, se não existe — publicada, com inscrições
 * abertas e datas a partir de hoje (para parecer "atual" em qualquer dia que o seed rodar).
 */
export async function seedMarketing(prisma: PrismaClient, now: Date = new Date()): Promise<{ posts: number; notices: number }> {
  let posts = 0;
  for (const [index, post] of SEED_POSTS.entries()) {
    if (await prisma.blogPost.findUnique({ where: { slug: post.slug }, select: { id: true } })) continue;
    const subject = post.subject ? await prisma.subject.findUnique({ where: { slug: post.subject }, select: { id: true } }) : null;
    await prisma.blogPost.create({
      data: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        subjectId: subject?.id ?? null,
        isPublished: true,
        publishedAt: new Date(now.getTime() - (index + 1) * 3 * DAY),
      },
    });
    posts += 1;
  }

  let notices = 0;
  const slug = "exemplo-banco-escriturario-2026";
  if (!(await prisma.examNotice.findUnique({ where: { slug }, select: { id: true } }))) {
    const board = await prisma.board.findUnique({ where: { slug: "cesgranrio" }, select: { id: true } });
    const subjects = await prisma.subject.findMany({
      where: { slug: { in: ["seguranca-da-informacao", "redes-e-internet", "office-e-libreoffice", "sistemas-operacionais"] } },
      select: { id: true },
    });
    const day = (offset: number) => new Date(`${new Date(now.getTime() + offset * DAY).toISOString().slice(0, 10)}T00:00:00Z`);
    await prisma.examNotice.create({
      data: {
        slug,
        title: "Exemplo — Banco (Escriturário) 2026",
        organization: "Banco de Exemplo S.A. (FICTÍCIO)",
        role: "Escriturário — Agente Comercial",
        boardId: board?.id ?? null,
        status: "OPEN",
        registrationEndsOn: day(30),
        examDate: day(75),
        vacancies: "1.000 + cadastro reserva",
        salary: "R$ 3.600,00",
        summary: "Página de EXEMPLO (concurso fictício) para testar as páginas de edital: datas, o que cai de TI e a oferta.",
        body: `Este é um concurso **fictício**, criado pelo conteúdo de exemplo do site.

## O que cai de TI

No cargo de escriturário, a banca costuma cobrar **Segurança da Informação**, **Redes e Internet** e **Office**. Comece pelo que mais cai e resolva questões da banca.

## Dicas

- Faça um simulado por semana nas últimas 4 semanas.
- Revise as questões que errou antes de cada simulado.`,
        isPublished: true,
        publishedAt: now,
        subjects: { create: subjects.map((subject) => ({ subjectId: subject.id })) },
      },
    });
    notices += 1;
  }
  return { posts, notices };
}
