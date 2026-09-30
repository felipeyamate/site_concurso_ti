#!/usr/bin/env bash
# =============================================================================
# vercel-build.sh — Comando de build usado pela Vercel (ver "buildCommand" no vercel.json).
#
# O que faz:
#  1. No deploy do SITE OFICIAL (VERCEL_ENV=production): aplica as migrações pendentes do banco
#     (`prisma migrate deploy`) ANTES de montar o site. Como a Vercel só coloca o deploy novo no
#     ar depois que o build termina, o código novo nunca roda com o banco antigo.
#  2. Nos deploys de TESTE (preview): só migra se MIGRATE_ON_PREVIEW=true — ligue isso apenas
#     quando cada preview tiver o SEU banco (ex.: integração Neon + Vercel, uma branch do banco
#     por preview). Assim, um preview nunca altera o banco de produção.
#  3. Monta o site (`next build`).
#
# Se a migração falhar, o build para e o site continua na versão anterior (nada quebra no ar).
# A migração usa a conexão DIRETA (DIRECT_URL, sem "-pooler"): ver prisma.config.ts.
# Paralelo em Python: é rodar `alembic upgrade head` no passo de deploy, antes de subir o app.
# =============================================================================
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "Deploy de produção: aplicando as migrações do banco..."
  npx prisma migrate deploy
elif [ "${VERCEL_ENV:-}" = "preview" ] && [ "${MIGRATE_ON_PREVIEW:-}" = "true" ]; then
  echo "Preview com banco próprio (MIGRATE_ON_PREVIEW=true): aplicando as migrações..."
  npx prisma migrate deploy
else
  echo "Sem migração neste deploy (VERCEL_ENV=${VERCEL_ENV:-não definido})."
fi

npx next build
