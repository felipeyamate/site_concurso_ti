/**
 * vitest.config.ts — Configuração dos testes automáticos (Vitest).
 *
 * Paralelo em Python: é o `pytest.ini`/`conftest.py`. O Vitest funciona como o pytest:
 * encontra arquivos `*.test.ts`, roda as funções `it(...)` e mostra o que passou/falhou.
 *
 * Dois grupos ("projects") de testes:
 *  - unit:        regras puras (sem banco). Rápidos. `npm test`
 *  - integration: usam um PostgreSQL de teste de verdade. `npm run test:integration`
 *                 (exige a variável TEST_DATABASE_URL — ver README).
 */
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Faz o `@/...` (atalho para `src/...`, definido no tsconfig.json) funcionar nos testes.
    tsconfigPaths: true,
    alias: {
      // O pacote `server-only` dá erro fora do Next.js de propósito. Nos testes, trocamos
      // por um arquivo vazio para conseguir testar o código de servidor.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // Roda uma vez antes de tudo: aplica as migrações no banco de teste.
          globalSetup: ["tests/integration/global-setup.ts"],
          // Roda antes de cada arquivo de teste: aponta o app para o banco de teste.
          setupFiles: ["tests/integration/setup-env.ts"],
          // Os testes compartilham o mesmo banco, então rodam um arquivo por vez.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
