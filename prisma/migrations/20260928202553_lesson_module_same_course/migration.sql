-- DropForeignKey
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_module_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "modules_id_course_id_key" ON "modules"("id", "course_id");

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_course_id_fkey" FOREIGN KEY ("module_id", "course_id") REFERENCES "modules"("id", "course_id") ON DELETE CASCADE ON UPDATE CASCADE;

