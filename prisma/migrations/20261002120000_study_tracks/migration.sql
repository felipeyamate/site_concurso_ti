-- Fase 8 — Trilhas de estudo por concurso/banca:
--  - lesson_subjects: assuntos que cada aula ensina ("estude esta aula" / "treinar questões deste assunto");
--  - tracks, track_sections, track_items: o roteiro (etapas com aulas de qualquer curso e treinos de questões);
--  - exam_notices.track_id: a trilha indicada numa página de concurso;
--  - SlugRedirectKind.TRACK: endereço antigo de uma trilha redireciona para o novo.

-- CreateEnum
CREATE TYPE "TrackItemKind" AS ENUM ('LESSON', 'PRACTICE');

-- AlterEnum
ALTER TYPE "SlugRedirectKind" ADD VALUE 'TRACK';

-- AlterTable
ALTER TABLE "exam_notices" ADD COLUMN     "track_id" TEXT;

-- CreateTable
CREATE TABLE "lesson_subjects" (
    "lesson_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,

    CONSTRAINT "lesson_subjects_pkey" PRIMARY KEY ("lesson_id","subject_id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "board_id" TEXT,
    "product_id" TEXT,
    "plan_id" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_sections" (
    "id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "subject_id" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "track_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_items" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "TrackItemKind" NOT NULL,
    "lesson_id" TEXT,
    "subject_id" TEXT,
    "board_id" TEXT,
    "question_goal" INTEGER NOT NULL DEFAULT 10,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "track_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_subjects_subject_id_idx" ON "lesson_subjects"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_slug_key" ON "tracks"("slug");

-- CreateIndex
CREATE INDEX "tracks_is_published_title_idx" ON "tracks"("is_published", "title");

-- CreateIndex
CREATE UNIQUE INDEX "track_sections_track_id_position_key" ON "track_sections"("track_id", "position");

-- CreateIndex
CREATE INDEX "track_items_lesson_id_idx" ON "track_items"("lesson_id");

-- CreateIndex
CREATE INDEX "track_items_subject_id_idx" ON "track_items"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "track_items_section_id_position_key" ON "track_items"("section_id", "position");

-- AddForeignKey
ALTER TABLE "exam_notices" ADD CONSTRAINT "exam_notices_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_subjects" ADD CONSTRAINT "lesson_subjects_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_subjects" ADD CONSTRAINT "lesson_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_sections" ADD CONSTRAINT "track_sections_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_sections" ADD CONSTRAINT "track_sections_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_items" ADD CONSTRAINT "track_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "track_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_items" ADD CONSTRAINT "track_items_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_items" ADD CONSTRAINT "track_items_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_items" ADD CONSTRAINT "track_items_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- -----------------------------------------------------------------------------
-- Travas extras (o Prisma não gera CHECK): o banco recusa itens impossíveis mesmo se
-- algum código tentar gravá-los.
-- -----------------------------------------------------------------------------

-- Item da trilha: AULA tem só a aula; TREINO tem o assunto (e a banca, opcional) e uma meta de 1 a 200
-- questões.
ALTER TABLE "track_items" ADD CONSTRAINT "track_items_kind_check" CHECK (
  ("kind" = 'LESSON' AND "lesson_id" IS NOT NULL AND "subject_id" IS NULL AND "board_id" IS NULL)
  OR ("kind" = 'PRACTICE' AND "lesson_id" IS NULL AND "subject_id" IS NOT NULL)
);
ALTER TABLE "track_items" ADD CONSTRAINT "track_items_goal_check" CHECK ("question_goal" BETWEEN 1 AND 200);

-- Endereço da trilha: letras minúsculas, números e hífens (o mesmo formato dos cursos e posts).
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
