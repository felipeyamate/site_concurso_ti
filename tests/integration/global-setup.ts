/**
 * global-setup.ts — Roda UMA vez antes dos testes de integração.
 *
 * O que faz:
 *  1. Aplica as migrações pendentes no banco de teste (`prisma migrate deploy`), garantindo que as
 *     tabelas existam e estejam na versão atual. (`deploy` só aplica o que falta; nunca apaga o banco.)
 *  2. Limpa as tabelas de VENDAS do banco de teste (Fase 4): pedidos e assinaturas não deixam
 *     apagar usuários (histórico financeiro), então sobras de uma execução interrompida
 *     atrapalhariam os outros testes, que começam apagando os usuários.
 */
import { execSync } from "node:child_process";

import { configureTestEnv } from "./test-env";

const RESET_SALES_SQL = `TRUNCATE TABLE fiscal_invoices, payments, webhook_events, order_courses, orders,
  subscriptions, billing_profiles, product_courses, products, plans;`;

export default function globalSetup(): void {
  configureTestEnv();
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
  execSync("npx prisma db execute --stdin", { input: RESET_SALES_SQL, stdio: ["pipe", "inherit", "inherit"], env: process.env });
}
