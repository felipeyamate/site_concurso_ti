-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE');

-- CreateEnum
CREATE TYPE "AttemptSource" AS ENUM ('PRACTICE', 'MOCK_EXAM');

-- CreateTable
CREATE TABLE "boards" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "board_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "type" "QuestionType" NOT NULL,
    "statement" TEXT NOT NULL,
    "correct_answer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "board_id" TEXT,
    "exam_id" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "source" "AttemptSource" NOT NULL,
    "mock_exam_id" TEXT,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_exams" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question_count" INTEGER NOT NULL,
    "time_limit_minutes" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "correct_count" INTEGER,

    CONSTRAINT "mock_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_exam_questions" (
    "id" TEXT NOT NULL,
    "mock_exam_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "answer" TEXT,
    "answered_at" TIMESTAMP(3),
    "is_correct" BOOLEAN,

    CONSTRAINT "mock_exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "boards_slug_key" ON "boards"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "boards_name_key" ON "boards"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_slug_key" ON "subjects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_key" ON "subjects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "exams_slug_key" ON "exams"("slug");

-- CreateIndex
CREATE INDEX "exams_board_id_idx" ON "exams"("board_id");

-- CreateIndex
CREATE UNIQUE INDEX "questions_code_key" ON "questions"("code");

-- CreateIndex
CREATE INDEX "questions_subject_id_idx" ON "questions"("subject_id");

-- CreateIndex
CREATE INDEX "questions_board_id_idx" ON "questions"("board_id");

-- CreateIndex
CREATE INDEX "questions_exam_id_idx" ON "questions"("exam_id");

-- CreateIndex
CREATE INDEX "questions_is_published_created_at_idx" ON "questions"("is_published", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_label_key" ON "question_options"("question_id", "label");

-- CreateIndex
CREATE INDEX "question_attempts_user_id_answered_at_idx" ON "question_attempts"("user_id", "answered_at");

-- CreateIndex
CREATE INDEX "question_attempts_question_id_idx" ON "question_attempts"("question_id");

-- CreateIndex
CREATE INDEX "question_attempts_mock_exam_id_idx" ON "question_attempts"("mock_exam_id");

-- CreateIndex
CREATE INDEX "mock_exams_user_id_started_at_idx" ON "mock_exams"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "mock_exam_questions_question_id_idx" ON "mock_exam_questions"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "mock_exam_questions_mock_exam_id_question_id_key" ON "mock_exam_questions"("mock_exam_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "mock_exam_questions_mock_exam_id_position_key" ON "mock_exam_questions"("mock_exam_id", "position");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "mock_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_exams" ADD CONSTRAINT "mock_exams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_exam_questions" ADD CONSTRAINT "mock_exam_questions_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "mock_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_exam_questions" ADD CONSTRAINT "mock_exam_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- -----------------------------------------------------------------------------
-- Travas extras (o Prisma não gera CHECK): o banco recusa dados impossíveis mesmo se
-- algum código tiver um erro.
-- -----------------------------------------------------------------------------

-- Gabarito: A–E na múltipla escolha; C (certo) ou E (errado) no Certo/Errado.
ALTER TABLE "questions" ADD CONSTRAINT "questions_correct_answer_check" CHECK (
  ("type" = 'MULTIPLE_CHOICE' AND "correct_answer" IN ('A', 'B', 'C', 'D', 'E'))
  OR ("type" = 'TRUE_FALSE' AND "correct_answer" IN ('C', 'E'))
);

-- Alternativas e respostas só podem ser letras de A a E.
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_label_check" CHECK ("label" IN ('A', 'B', 'C', 'D', 'E'));
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_answer_check" CHECK ("answer" IN ('A', 'B', 'C', 'D', 'E'));
ALTER TABLE "mock_exam_questions" ADD CONSTRAINT "mock_exam_questions_answer_check" CHECK ("answer" IS NULL OR "answer" IN ('A', 'B', 'C', 'D', 'E'));

-- Resposta de simulado vem junto com o simulado (e resposta avulsa, sem).
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_source_check" CHECK (
  ("source" = 'MOCK_EXAM' AND "mock_exam_id" IS NOT NULL) OR ("source" = 'PRACTICE' AND "mock_exam_id" IS NULL)
);

-- Ano de prova plausível; simulado com questões e tempo positivos; acertos entre 0 e o total.
ALTER TABLE "exams" ADD CONSTRAINT "exams_year_check" CHECK ("year" BETWEEN 1990 AND 2100);
ALTER TABLE "mock_exams" ADD CONSTRAINT "mock_exams_values_check" CHECK (
  "question_count" > 0
  AND ("time_limit_minutes" IS NULL OR "time_limit_minutes" > 0)
  AND ("correct_count" IS NULL OR ("correct_count" >= 0 AND "correct_count" <= "question_count"))
);
