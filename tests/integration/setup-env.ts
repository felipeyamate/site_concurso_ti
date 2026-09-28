/**
 * setup-env.ts — Roda antes de cada arquivo de teste de integração.
 * Aponta o app (src/lib/db.ts, src/lib/env.ts) para o banco de teste.
 */
import { configureTestEnv } from "./test-env";

configureTestEnv();
