/**
 * global-setup.ts — Roda UMA vez antes dos testes de integração.
 *
 * O que faz: aplica as migrações pendentes no banco de teste (`prisma migrate deploy`),
 * garantindo que as tabelas existam e estejam na versão atual.
 * (`deploy` só aplica o que falta; nunca apaga o banco.)
 */
import { execSync } from "node:child_process";

import { configureTestEnv } from "./test-env";

export default function globalSetup(): void {
  configureTestEnv();
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}
