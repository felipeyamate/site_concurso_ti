-- Fase 7 — Registro de acesso do Marco Civil da Internet (art. 15): data, hora e IP de cada login,
-- guardados por 6 meses (a limpeza diária apaga os mais velhos). Ver `AccessLog` no schema.prisma.

-- CreateTable
CREATE TABLE "access_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_logs_user_id_created_at_idx" ON "access_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "access_logs_created_at_idx" ON "access_logs"("created_at");

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

