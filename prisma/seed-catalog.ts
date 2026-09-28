/**
 * seed-catalog.ts — Conteúdo de EXEMPLO do catálogo (cursos, módulos e aulas) e a função que grava.
 *
 * Quem chama: `prisma/seed.ts` (comando `npm run db:seed`) e os testes de integração.
 * O que devolve: `seedCatalog(prisma)` grava/atualiza os cursos e devolve quantos itens gravou.
 *
 * Para que serve: ter um curso navegável em desenvolvimento, antes do painel admin (Fase 3).
 * Os vídeos são de exemplo (provedor DEV). O conteúdo real será cadastrado pelo admin.
 *
 * Pode rodar quantas vezes quiser ("idempotente"): usa `upsert` (atualiza se existe, cria se não),
 * identificando curso pelo `slug`, módulo pela posição e aula pelo `slug`.
 * Paralelo em Python/Django: é como um `update_or_create` para cada item.
 *
 * Também SINCRONIZA: se você reordenar, mover ou apagar aulas/módulos nos dados abaixo e rodar
 * de novo, o banco fica igual aos dados (aulas e módulos que saíram são apagados).
 */
import type { PrismaClient } from "../src/generated/prisma/client";

type SeedLesson = {
  slug: string;
  title: string;
  description: string;
  durationMinutes: number;
  isFreePreview?: boolean;
};

type SeedModule = {
  title: string;
  lessons: SeedLesson[];
};

type SeedCourse = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  isPublished: boolean;
  position: number;
  modules: SeedModule[];
};

export const SEED_COURSES: SeedCourse[] = [
  {
    slug: "informatica-e-ti-do-zero",
    title: "Informática e TI para Concursos — do zero",
    subtitle: "O núcleo que cai em quase todo edital, explicado para quem nunca estudou TI.",
    description:
      "Curso base para cargos que não são de TI (bancos, tribunais, INSS, agências). " +
      "Cada módulo começa pelo que mais cai nas provas e usa exemplos do dia a dia. " +
      "Ao final de cada aula, você sabe reconhecer as pegadinhas mais comuns das bancas.",
    isPublished: true,
    position: 1,
    modules: [
      {
        title: "Comece por aqui",
        lessons: [
          {
            slug: "como-a-informatica-cai-nas-provas",
            title: "Como a Informática cai nas provas",
            description:
              "Quais assuntos mais aparecem em cada banca e como usar este curso para estudar primeiro o que dá mais pontos.",
            durationMinutes: 9,
            isFreePreview: true,
          },
          {
            slug: "como-estudar-este-curso",
            title: "Como estudar este curso",
            description:
              "Um roteiro simples: assistir, revisar com o resumo e resolver questões logo em seguida.",
            durationMinutes: 6,
          },
        ],
      },
      {
        title: "Hardware e software",
        lessons: [
          {
            slug: "computador-por-dentro",
            title: "O computador por dentro: processador, memória e armazenamento",
            description:
              "A diferença entre memória RAM (rápida, temporária) e armazenamento (HD/SSD, permanente) — pegadinha clássica.",
            durationMinutes: 14,
          },
          {
            slug: "tipos-de-software-e-licencas",
            title: "Tipos de software e licenças",
            description:
              "Sistema operacional x aplicativo, software livre x gratuito (freeware) x proprietário.",
            durationMinutes: 12,
          },
        ],
      },
      {
        title: "Windows, pastas e arquivos",
        lessons: [
          {
            slug: "pastas-arquivos-e-extensoes",
            title: "Pastas, arquivos e extensões",
            description: "O que é .docx, .pdf, .exe, .zip — e por que a extensão importa para a segurança.",
            durationMinutes: 11,
          },
          {
            slug: "atalhos-de-teclado-que-mais-caem",
            title: "Atalhos de teclado que mais caem",
            description: "Ctrl+C, Ctrl+V, Ctrl+Z, Win+E, Alt+Tab e os atalhos que as bancas adoram trocar.",
            durationMinutes: 10,
          },
        ],
      },
      {
        title: "Editores de texto e planilhas",
        lessons: [
          {
            slug: "word-e-writer-o-essencial",
            title: "Word e Writer: o essencial",
            description: "Formatação, estilos, cabeçalho/rodapé e as diferenças entre o Microsoft Word e o LibreOffice Writer.",
            durationMinutes: 15,
          },
          {
            slug: "excel-e-calc-funcoes-que-mais-caem",
            title: "Excel e Calc: fórmulas e funções que mais caem",
            description: "Referência relativa e absoluta ($A$1), SOMA, MÉDIA, SE e PROCV — com exemplos de questão.",
            durationMinutes: 18,
          },
        ],
      },
      {
        title: "Internet e correio eletrônico",
        lessons: [
          {
            slug: "navegadores-historico-cookies",
            title: "Navegadores: abas, histórico, modo anônimo e cookies",
            description: "O que o modo anônimo NÃO esconde (pegadinha frequente) e para que servem os cookies.",
            durationMinutes: 12,
          },
          {
            slug: "email-cc-cco-e-protocolos",
            title: "E-mail: CC, CCO e protocolos (SMTP, POP, IMAP)",
            description: "Quem vê quem numa mensagem com CC e CCO, e qual protocolo envia e qual recebe.",
            durationMinutes: 13,
          },
        ],
      },
      {
        title: "Segurança da Informação",
        lessons: [
          {
            slug: "pilares-da-seguranca",
            title: "Os pilares: confidencialidade, integridade e disponibilidade",
            description: "O trio que aparece em quase toda prova, com exemplos para nunca mais confundir.",
            durationMinutes: 11,
          },
          {
            slug: "malwares-virus-worm-trojan-ransomware",
            title: "Malwares: vírus, worm, trojan e ransomware",
            description: "Como cada praga age e as diferenças que as bancas cobram (vírus precisa de hospedeiro; worm não).",
            durationMinutes: 16,
            isFreePreview: true,
          },
          {
            slug: "golpes-phishing-engenharia-social",
            title: "Golpes: phishing e engenharia social",
            description: "Como reconhecer um golpe e as boas práticas que as questões esperam que você marque.",
            durationMinutes: 10,
          },
          {
            slug: "backup-completo-incremental-diferencial",
            title: "Backup: completo, incremental e diferencial",
            description: "O que cada tipo copia e quanto tempo leva para restaurar — com tabela comparativa.",
            durationMinutes: 12,
          },
        ],
      },
      {
        title: "Redes e computação em nuvem",
        lessons: [
          {
            slug: "redes-em-linguagem-simples",
            title: "Redes em linguagem simples: LAN, WAN, IP e Wi-Fi",
            description: "Os tipos de rede e o que é um endereço IP, sem jargão.",
            durationMinutes: 14,
          },
          {
            slug: "computacao-em-nuvem-iaas-paas-saas",
            title: "Computação em nuvem: IaaS, PaaS e SaaS",
            description: "Os modelos de serviço com exemplos do dia a dia (Gmail, Google Drive, servidores alugados).",
            durationMinutes: 11,
          },
        ],
      },
    ],
  },
  {
    // Rascunho: não aparece para alunos. Serve para testar a regra "só publicados" e o preview do professor.
    slug: "ti-banco-do-brasil-cesgranrio",
    title: "TI para o Banco do Brasil — Cesgranrio",
    subtitle: "Trilha direcionada (em produção).",
    description: "Trilha focada no edital do Banco do Brasil, banca Cesgranrio. Em produção.",
    isPublished: false,
    position: 2,
    modules: [
      {
        title: "O edital do Banco do Brasil",
        lessons: [
          {
            slug: "o-que-cai-de-ti-no-bb",
            title: "O que cai de TI no Banco do Brasil",
            description: "Mapa de incidência dos assuntos de TI nas últimas provas.",
            durationMinutes: 8,
          },
        ],
      },
    ],
  },
];

export type SeedResult = { courses: number; modules: number; lessons: number };

/**
 * Grava (ou atualiza) os cursos de exemplo.
 *
 * Passos, para cada curso: 1) upsert do curso pelo slug; 2) upsert de cada módulo pela posição;
 * 3) upsert de cada aula pelo slug dentro do curso. Posições começam em 1.
 */
export async function seedCatalog(prisma: PrismaClient): Promise<SeedResult> {
  const result: SeedResult = { courses: 0, modules: 0, lessons: 0 };

  for (const seedCourse of SEED_COURSES) {
    const courseData = {
      title: seedCourse.title,
      subtitle: seedCourse.subtitle,
      description: seedCourse.description,
      isPublished: seedCourse.isPublished,
      position: seedCourse.position,
    };
    const course = await prisma.course.upsert({
      where: { slug: seedCourse.slug },
      create: { slug: seedCourse.slug, ...courseData },
      update: courseData,
    });
    result.courses += 1;

    // Antes de gravar as aulas, "estaciona" as posições atuais em números negativos.
    // Sem isso, trocar duas aulas de lugar esbarraria na regra "uma aula por posição no módulo"
    // (a primeira aula tentaria ocupar a posição que a segunda ainda está usando).
    // Posição provisória = posição × -1 (negativa e ainda única no módulo). SQL direto porque o
    // Prisma não faz "position = -position" num comando só.
    await prisma.$executeRaw`UPDATE lessons SET position = -position WHERE course_id = ${course.id} AND position > 0`;

    for (const [moduleIndex, seedModule] of seedCourse.modules.entries()) {
      const modulePosition = moduleIndex + 1;
      const courseModule = await prisma.module.upsert({
        where: { courseId_position: { courseId: course.id, position: modulePosition } },
        create: { courseId: course.id, position: modulePosition, title: seedModule.title },
        update: { title: seedModule.title },
      });
      result.modules += 1;

      for (const [lessonIndex, seedLesson] of seedModule.lessons.entries()) {
        const lessonData = {
          moduleId: courseModule.id,
          position: lessonIndex + 1,
          title: seedLesson.title,
          description: seedLesson.description,
          durationSeconds: seedLesson.durationMinutes * 60,
          isFreePreview: seedLesson.isFreePreview ?? false,
          isPublished: true,
          videoProvider: "DEV" as const,
          videoId: "exemplo",
        };
        await prisma.lesson.upsert({
          where: { courseId_slug: { courseId: course.id, slug: seedLesson.slug } },
          create: { courseId: course.id, slug: seedLesson.slug, ...lessonData },
          update: lessonData,
        });
        result.lessons += 1;
      }
    }

    // Limpeza: apaga aulas e módulos que não estão mais nos dados de exemplo.
    const seedSlugs = seedCourse.modules.flatMap((seedModule) => seedModule.lessons.map((lesson) => lesson.slug));
    await prisma.lesson.deleteMany({ where: { courseId: course.id, slug: { notIn: seedSlugs } } });
    await prisma.module.deleteMany({ where: { courseId: course.id, position: { gt: seedCourse.modules.length } } });
  }

  return result;
}
