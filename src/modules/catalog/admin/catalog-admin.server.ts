/**
 * catalog-admin.server.ts — Leitura e gravação do catálogo pelo painel (cursos, módulos e aulas).
 *
 * Quem chama: as Server Actions de `actions.ts` (que já conferiram login + perfil) e as páginas
 * de /admin/cursos. Os testes de integração chamam direto.
 * O que devolve: os dados pedidos; em caso de problema ESPERADO, lança `UserFacingError` com uma
 * mensagem em português (ex.: "já existe um curso com este endereço").
 *
 * Regras importantes:
 *  - Nunca apagamos histórico de aluno: curso com matrícula, ou aula que algum ALUNO já assistiu,
 *    não pode ser apagado — a saída é despublicar (tira do ar e guarda tudo).
 *  - Cursos e aulas novos nascem como RASCUNHO (só professor/admin veem até publicar).
 *  - Posições (ordem) são sempre 1, 2, 3... dentro do curso (módulos) e do módulo (aulas).
 *  - Apagar aula/curso devolve os caminhos dos PDFs, para quem chamou apagar os arquivos também.
 *  - Antes de conferir "pode apagar?", TRAVAMOS as linhas que vão ser apagadas (ver `lockRows`):
 *    assim nenhum progresso/matrícula novo entra entre a conferência e o apagar.
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isRecordNotFound, isUniqueViolation } from "@/lib/db-errors";
import { UserFacingError } from "@/lib/form-state";
import { parsePandaEmbedInput } from "@/modules/video/panda/embed";

import { moveItem } from "./reorder";
import type { VideoSource } from "./schemas";
import { findAvailableSlug } from "./slug";

type Tx = Prisma.TransactionClient;
type Direction = "up" | "down";

// ID gravado nas aulas com o vídeo de exemplo (provedor DEV). Qualquer valor serve: o provedor
// DEV sempre toca DEV_SAMPLE_VIDEO_URL.
const DEV_VIDEO_ID = "exemplo";

/**
 * Progresso que conta como "histórico de aluno": de quem é ALUNO hoje, ou de quem tem (ou teve)
 * matrícula no curso — assim, um aluno promovido a professor (ex.: monitor) continua protegido.
 * O progresso de professor/admin só testando as aulas não conta.
 */
function studentProgressIn(courseId: string): Prisma.LessonProgressWhereInput {
  return { OR: [{ user: { role: "STUDENT" } }, { user: { enrollments: { some: { courseId } } } }] };
}

// Transações que mexem em várias linhas: prazo maior que o padrão (5 s), para bancos distantes.
const TRANSACTION_OPTIONS = { timeout: 15_000 } as const;

// Posições são ÚNICAS dentro do curso/módulo: se duas pessoas mexem na ordem ao mesmo tempo, o
// banco recusa a segunda gravação (UNIQUE). Não é bug — basta recarregar e tentar de novo.
const CONCURRENT_CHANGE_MESSAGE =
  "Outra alteração foi feita neste curso ao mesmo tempo. Recarregue a página e tente de novo.";

/**
 * Roda uma transação que mexe em posições; o conflito de posição vira a mensagem acima
 * (em vez de "Algo deu errado").
 */
async function runPositionTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(work, TRANSACTION_OPTIONS);
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError(CONCURRENT_CHANGE_MESSAGE);
    throw error;
  }
}

/**
 * Trava linhas até o fim da transação (`SELECT ... FOR UPDATE`).
 *
 * Por que: apagar é "conferir se há histórico de aluno → apagar". Sem a trava, um progresso ou
 * matrícula gravado ENTRE as duas coisas seria apagado junto (as tabelas apagam "em cascata").
 * Com a trava, quem tenta gravar progresso/matrícula ligado a essas linhas espera o fim da nossa
 * transação (o banco confere a chave estrangeira na linha travada) — e, se a gravação veio antes,
 * nós é que esperamos e a conferência já a enxerga.
 * Paralelo em Python: `select_for_update()` do Django.
 */
const lockRows = {
  course: (tx: Tx, courseId: string) => tx.$executeRaw`SELECT id FROM courses WHERE id = ${courseId} FOR UPDATE`,
  lessonsOfCourse: (tx: Tx, courseId: string) =>
    tx.$executeRaw`SELECT id FROM lessons WHERE course_id = ${courseId} FOR UPDATE`,
  module: (tx: Tx, moduleId: string) => tx.$executeRaw`SELECT id FROM modules WHERE id = ${moduleId} FOR UPDATE`,
  lesson: (tx: Tx, lessonId: string) => tx.$executeRaw`SELECT id FROM lessons WHERE id = ${lessonId} FOR UPDATE`,
};

// =============================================================================================
// Leitura (páginas do painel)
// =============================================================================================

export async function listCoursesForAdmin() {
  return prisma.course.findMany({
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      isPublished: true,
      _count: { select: { modules: true, lessons: true, enrollments: true } },
    },
  });
}

export async function getCourseForAdmin(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              slug: true,
              title: true,
              isPublished: true,
              isFreePreview: true,
              durationSeconds: true,
              videoId: true,
              videoProvider: true,
              _count: { select: { attachments: true } },
            },
          },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });
}

export async function getLessonForAdmin(lessonId: string) {
  return prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      course: {
        select: {
          id: true,
          slug: true,
          title: true,
          modules: { orderBy: { position: "asc" }, select: { id: true, title: true, position: true } },
        },
      },
      // Sem `storageKey`: o caminho do arquivo no armazenamento nunca vai para a página.
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, fileName: true, sizeBytes: true },
      },
    },
  });
}

/** Quantos alunos têm histórico nesta aula (a página avisa que ela não pode ser apagada). */
export async function countStudentProgress(lessonId: string, courseId: string): Promise<number> {
  return prisma.lessonProgress.count({ where: { lessonId, ...studentProgressIn(courseId) } });
}

// =============================================================================================
// Cursos
// =============================================================================================

/** Cria um curso (rascunho) no fim da lista, com endereço gerado a partir do título. */
export async function createCourse(input: { title: string }) {
  const slug = await findAvailableSlug(input.title, async (candidate) =>
    Boolean(await prisma.course.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );
  const last = await prisma.course.aggregate({ _max: { position: true } });
  try {
    return await prisma.course.create({
      data: {
        title: input.title,
        slug,
        description: "",
        isPublished: false,
        position: (last._max.position ?? 0) + 1,
      },
    });
  } catch (error) {
    // Duas pessoas criando cursos com o mesmo título ao mesmo tempo.
    if (isUniqueViolation(error)) throw new UserFacingError("Já existe um curso com este título. Tente de novo.");
    throw error;
  }
}

export async function updateCourse(input: {
  courseId: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string;
  isPublished: boolean;
}) {
  try {
    return await prisma.course.update({
      where: { id: input.courseId },
      data: {
        title: input.title,
        slug: input.slug,
        subtitle: input.subtitle,
        description: input.description,
        isPublished: input.isPublished,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new UserFacingError("Já existe outro curso com este endereço.", { field: "slug" });
    }
    if (isRecordNotFound(error)) throw new UserFacingError("Curso não encontrado.");
    throw error;
  }
}

/** Sobe/desce o curso na ordem do catálogo. */
export async function moveCourse(courseId: string, direction: Direction) {
  await prisma.$transaction(async (tx) => {
    const courses = await tx.course.findMany({
      orderBy: [{ position: "asc" }, { title: "asc" }],
      select: { id: true },
    });
    const order = moveItem(
      courses.map((course) => course.id),
      courseId,
      direction,
    );
    if (!order) return;
    // Cursos não têm posição única no banco: basta regravar 1, 2, 3...
    for (const [index, id] of order.entries()) {
      await tx.course.update({ where: { id }, data: { position: index + 1 } });
    }
  }, TRANSACTION_OPTIONS);
}

/**
 * Apaga um curso inteiro (módulos, aulas e materiais) — só se nenhum aluno tem histórico nele.
 * Devolve os caminhos dos PDFs que estavam no curso (quem chamou apaga os arquivos).
 */
export async function deleteCourse(courseId: string): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    // O curso trava novas matrículas (e aulas); as aulas travam novos progressos.
    await lockRows.course(tx, courseId);
    await lockRows.lessonsOfCourse(tx, courseId);
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { _count: { select: { enrollments: true, orderItems: true } } },
    });
    if (!course) throw new UserFacingError("Curso não encontrado.");
    if (course._count.enrollments > 0) {
      throw new UserFacingError(
        "Este curso tem matrículas (mesmo vencidas ou canceladas). Para tirá-lo do ar, despublique em vez de apagar.",
      );
    }
    // Pedidos (mesmo não pagos) são histórico financeiro: o curso fica guardado.
    if (course._count.orderItems > 0) {
      throw new UserFacingError("Este curso aparece em pedidos de compra. Para tirá-lo do ar, despublique em vez de apagar.");
    }
    const watched = await tx.lessonProgress.count({ where: { lesson: { courseId }, ...studentProgressIn(courseId) } });
    if (watched > 0) {
      throw new UserFacingError("Alunos já assistiram aulas deste curso. Despublique em vez de apagar.");
    }
    const attachments = await tx.lessonAttachment.findMany({
      where: { lesson: { courseId } },
      select: { storageKey: true },
    });
    await tx.course.delete({ where: { id: courseId } });
    return attachments.map((attachment) => attachment.storageKey);
  }, TRANSACTION_OPTIONS);
}

// =============================================================================================
// Módulos
// =============================================================================================

type Positioned = { id: string; position: number };

// Troca dois módulos de lugar. As posições são ÚNICAS dentro do curso, então usamos uma posição
// temporária (-1) — como trocar dois copos de lugar usando um terceiro: 3 comandos, sempre.
async function swapModules(tx: Tx, a: Positioned, b: Positioned) {
  await tx.module.update({ where: { id: a.id }, data: { position: -1 } });
  await tx.module.update({ where: { id: b.id }, data: { position: a.position } });
  await tx.module.update({ where: { id: a.id }, data: { position: b.position } });
}

// Fecha o "buraco" deixado na posição `removed`: os módulos seguintes sobem uma posição, do menor
// para o maior (assim nunca há duas posições iguais no meio do caminho).
async function closeModuleGap(tx: Tx, courseId: string, removed: number) {
  const after = await tx.module.findMany({
    where: { courseId, position: { gt: removed } },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  for (const item of after) {
    await tx.module.update({ where: { id: item.id }, data: { position: item.position - 1 } });
  }
}

export async function createModule(input: { courseId: string; title: string }) {
  return runPositionTransaction(async (tx) => {
    const course = await tx.course.findUnique({ where: { id: input.courseId }, select: { id: true } });
    if (!course) throw new UserFacingError("Curso não encontrado.");
    const last = await tx.module.aggregate({ where: { courseId: course.id }, _max: { position: true } });
    return tx.module.create({
      data: { courseId: course.id, title: input.title, position: (last._max.position ?? 0) + 1 },
    });
  });
}

export async function renameModule(input: { moduleId: string; title: string }) {
  try {
    return await prisma.module.update({ where: { id: input.moduleId }, data: { title: input.title } });
  } catch (error) {
    if (isRecordNotFound(error)) throw new UserFacingError("Módulo não encontrado.");
    throw error;
  }
}

export async function moveModule(moduleId: string, direction: Direction) {
  await runPositionTransaction(async (tx) => {
    const current = await tx.module.findUnique({
      where: { id: moduleId },
      select: { id: true, courseId: true, position: true },
    });
    if (!current) throw new UserFacingError("Módulo não encontrado.");
    // O vizinho: o módulo imediatamente acima (↑) ou abaixo (↓). Sem vizinho, nada muda.
    const neighbor = await tx.module.findFirst({
      where: {
        courseId: current.courseId,
        position: direction === "up" ? { lt: current.position } : { gt: current.position },
      },
      orderBy: { position: direction === "up" ? "desc" : "asc" },
      select: { id: true, position: true },
    });
    if (neighbor) await swapModules(tx, current, neighbor);
  });
}

/** Apaga um módulo VAZIO (as aulas precisam ser movidas ou apagadas antes). */
export async function deleteModule(moduleId: string) {
  await runPositionTransaction(async (tx) => {
    // Trava o módulo: uma aula (com histórico) movida para ele agora não é apagada junto.
    await lockRows.module(tx, moduleId);
    const courseModule = await tx.module.findUnique({
      where: { id: moduleId },
      select: { courseId: true, position: true, _count: { select: { lessons: true } } },
    });
    if (!courseModule) throw new UserFacingError("Módulo não encontrado.");
    if (courseModule._count.lessons > 0) {
      throw new UserFacingError("O módulo ainda tem aulas. Mova as aulas para outro módulo ou apague-as antes.");
    }
    await tx.module.delete({ where: { id: moduleId } });
    await closeModuleGap(tx, courseModule.courseId, courseModule.position);
  });
}

// =============================================================================================
// Aulas
// =============================================================================================

// Mesmas ideias dos módulos (ver `swapModules` e `closeModuleGap`), dentro de um módulo.
async function swapLessons(tx: Tx, a: Positioned, b: Positioned) {
  await tx.lesson.update({ where: { id: a.id }, data: { position: -1 } });
  await tx.lesson.update({ where: { id: b.id }, data: { position: a.position } });
  await tx.lesson.update({ where: { id: a.id }, data: { position: b.position } });
}

async function closeLessonGap(tx: Tx, moduleId: string, removed: number) {
  const after = await tx.lesson.findMany({
    where: { moduleId, position: { gt: removed } },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  for (const item of after) {
    await tx.lesson.update({ where: { id: item.id }, data: { position: item.position - 1 } });
  }
}

async function nextLessonPosition(tx: Tx, moduleId: string): Promise<number> {
  const last = await tx.lesson.aggregate({ where: { moduleId }, _max: { position: true } });
  return (last._max.position ?? 0) + 1;
}

/** Cria uma aula (rascunho, sem vídeo) no fim do módulo. */
export async function createLesson(input: { moduleId: string; title: string }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const courseModule = await tx.module.findUnique({ where: { id: input.moduleId }, select: { courseId: true } });
      if (!courseModule) throw new UserFacingError("Módulo não encontrado.");
      const slug = await findAvailableSlug(input.title, async (candidate) =>
        Boolean(
          await tx.lesson.findUnique({
            where: { courseId_slug: { courseId: courseModule.courseId, slug: candidate } },
            select: { id: true },
          }),
        ),
      );
      return tx.lesson.create({
        data: {
          courseId: courseModule.courseId,
          moduleId: input.moduleId,
          title: input.title,
          slug,
          position: await nextLessonPosition(tx, input.moduleId),
          isPublished: false,
          videoProvider: "PANDA",
          videoId: null,
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Outra aula foi criada ao mesmo tempo. Tente de novo.");
    throw error;
  }
}

export async function updateLesson(input: {
  lessonId: string;
  moduleId: string;
  title: string;
  slug: string;
  description: string;
  isFreePreview: boolean;
  isPublished: boolean;
}) {
  return runPositionTransaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: input.lessonId },
      select: { courseId: true, moduleId: true, position: true },
    });
    if (!lesson) throw new UserFacingError("Aula não encontrada.");

    // O endereço é conferido ANTES de gravar: assim a mensagem certa aparece no campo certo
    // (um conflito na gravação pode ser de endereço OU de posição, e aí não dá para saber qual).
    const slugTaken = await tx.lesson.findFirst({
      where: { courseId: lesson.courseId, slug: input.slug, id: { not: input.lessonId } },
      select: { id: true },
    });
    if (slugTaken) {
      throw new UserFacingError("Já existe outra aula com este endereço neste curso.", { field: "slug" });
    }

    // Trocar de módulo: só para um módulo do MESMO curso; a aula vai para o fim dele.
    let position = lesson.position;
    if (input.moduleId !== lesson.moduleId) {
      const target = await tx.module.findFirst({
        where: { id: input.moduleId, courseId: lesson.courseId },
        select: { id: true },
      });
      if (!target) throw new UserFacingError("Escolha um módulo deste curso.", { field: "moduleId" });
      position = await nextLessonPosition(tx, target.id);
    }

    const updated = await tx.lesson.update({
      where: { id: input.lessonId },
      data: {
        moduleId: input.moduleId,
        position,
        title: input.title,
        slug: input.slug,
        description: input.description,
        isFreePreview: input.isFreePreview,
        isPublished: input.isPublished,
      },
    });
    // Saiu de um módulo: as aulas seguintes do módulo antigo sobem uma posição.
    if (input.moduleId !== lesson.moduleId) await closeLessonGap(tx, lesson.moduleId, lesson.position);
    return updated;
  });
}

/**
 * Define o vídeo da aula.
 *  - NONE:  aula sem vídeo (ex.: só texto/PDF).
 *  - PANDA: confere o link do player do Panda e guarda o link limpo + o ID do vídeo.
 *  - DEV:   vídeo de exemplo (só desenvolvimento; recusado em produção).
 */
export async function updateLessonVideo(input: {
  lessonId: string;
  source: VideoSource;
  pandaEmbed: string;
  durationSeconds: number;
  isProduction: boolean;
}) {
  let data: Prisma.LessonUpdateInput;
  switch (input.source) {
    case "NONE":
      data = { videoId: null, videoEmbedUrl: null };
      break;
    case "PANDA": {
      const parsed = parsePandaEmbedInput(input.pandaEmbed);
      if (!parsed.ok) throw new UserFacingError(parsed.error, { field: "pandaEmbed" });
      data = { videoProvider: "PANDA", videoId: parsed.videoId, videoEmbedUrl: parsed.embedUrl };
      break;
    }
    case "DEV":
      if (input.isProduction) {
        throw new UserFacingError("O vídeo de exemplo não pode ser usado no site de produção.", { field: "source" });
      }
      data = { videoProvider: "DEV", videoId: DEV_VIDEO_ID, videoEmbedUrl: null };
      break;
  }

  try {
    return await prisma.lesson.update({
      where: { id: input.lessonId },
      data: { ...data, durationSeconds: input.durationSeconds },
    });
  } catch (error) {
    if (isRecordNotFound(error)) throw new UserFacingError("Aula não encontrada.");
    throw error;
  }
}

export async function moveLesson(lessonId: string, direction: Direction) {
  await runPositionTransaction(async (tx) => {
    const current = await tx.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, moduleId: true, position: true },
    });
    if (!current) throw new UserFacingError("Aula não encontrada.");
    const neighbor = await tx.lesson.findFirst({
      where: {
        moduleId: current.moduleId,
        position: direction === "up" ? { lt: current.position } : { gt: current.position },
      },
      orderBy: { position: direction === "up" ? "desc" : "asc" },
      select: { id: true, position: true },
    });
    if (neighbor) await swapLessons(tx, current, neighbor);
  });
}

/**
 * Apaga uma aula — só se nenhum ALUNO tem progresso nela (senão, despublique).
 * Devolve o curso da aula e os caminhos dos PDFs dela (quem chamou apaga os arquivos).
 */
export async function deleteLesson(lessonId: string): Promise<{ courseId: string; storageKeys: string[] }> {
  return runPositionTransaction(async (tx) => {
    // Trava a aula: um progresso de aluno gravado agora espera (e a conferência abaixo o enxerga).
    await lockRows.lesson(tx, lessonId);
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      select: {
        courseId: true,
        moduleId: true,
        position: true,
        attachments: { select: { storageKey: true } },
      },
    });
    if (!lesson) throw new UserFacingError("Aula não encontrada.");
    const watched = await tx.lessonProgress.count({ where: { lessonId, ...studentProgressIn(lesson.courseId) } });
    if (watched > 0) {
      throw new UserFacingError("Alunos já assistiram esta aula. Despublique em vez de apagar, para não perder o histórico.");
    }
    await tx.lesson.delete({ where: { id: lessonId } });
    await closeLessonGap(tx, lesson.moduleId, lesson.position);
    return { courseId: lesson.courseId, storageKeys: lesson.attachments.map((item) => item.storageKey) };
  });
}
