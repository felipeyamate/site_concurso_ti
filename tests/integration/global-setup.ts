/**
 * global-setup.ts — Roda UMA vez antes dos testes de integração.
 *
 * O que faz:
 *  1. Aplica as migrações pendentes no banco de teste (`prisma migrate deploy`), garantindo que as
 *     tabelas existam e estejam na versão atual. (`deploy` só aplica o que falta; nunca apaga o banco.)
 *  2. Limpa as tabelas de VENDAS (Fase 4), do BANCO DE QUESTÕES (Fase 5) e de MARKETING (Fase 6)
 *     do banco de teste: pedidos, assinaturas e afiliados não deixam apagar usuários (histórico
 *     financeiro) e questões respondidas não deixam apagar assuntos/bancas; sobras de uma execução
 *     interrompida atrapalhariam os outros testes, que começam apagando os usuários.
 *     Também os aceites da LGPD (Fase 7): o registro de consentimento não deixa apagar o usuário.
 */
import { execSync } from "node:child_process";

import { configureTestEnv } from "./test-env";

const RESET_SALES_SQL = `TRUNCATE TABLE affiliate_payout_items, affiliate_payouts, affiliate_click_days,
  fiscal_invoices, payments, webhook_events, order_courses, orders, subscriptions,
  coupon_products, coupon_plans, coupons, affiliates, billing_profiles, product_courses,
  exam_notice_subjects, exam_notices, blog_posts, slug_redirects, products, plans,
  question_attempts, mock_exam_questions, mock_exams, question_options, questions, exams, subjects, boards,
  legal_consents, access_logs, track_items, track_sections, tracks, lesson_subjects;`;

export default function globalSetup(): void {
  configureTestEnv();
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
  execSync("npx prisma db execute --stdin", { input: RESET_SALES_SQL, stdio: ["pipe", "inherit", "inherit"], env: process.env });
}
