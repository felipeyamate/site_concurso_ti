/**
 * db-errors.ts — Reconhece os erros "esperados" do banco (via Prisma).
 *
 * Quem chama: funções do painel admin que gravam dados, para transformar o erro técnico numa
 * mensagem clara (ex.: "já existe um curso com este endereço").
 *
 * Códigos do Prisma usados (documentação "Prisma error reference"):
 *   P2002 = valor repetido numa coluna que precisa ser única (UNIQUE);
 *   P2025 = o registro a alterar/apagar não existe;
 *   P2034 = conflito entre duas transações simultâneas (numa transação "serializável", o banco
 *           cancela uma delas em vez de deixar as duas gravarem um resultado inconsistente).
 * Paralelo em Python: como capturar `IntegrityError` / `DoesNotExist` no Django.
 */
import "server-only";

import { Prisma } from "@/generated/prisma/client";

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export function isUniqueViolation(error: unknown): boolean {
  return hasPrismaCode(error, "P2002");
}

export function isRecordNotFound(error: unknown): boolean {
  return hasPrismaCode(error, "P2025");
}

export function isTransactionConflict(error: unknown): boolean {
  if (hasPrismaCode(error, "P2034")) return true;
  // Com o driver `pg`, o erro do PostgreSQL (código 40001) pode chegar sem ser traduzido.
  return error instanceof Error && /could not serialize|40001/i.test(error.message);
}
