/**
 * eslint.config.mjs — Regras do "lint" (`npm run lint`): aponta erros comuns e más práticas
 * no código, antes de rodar. Paralelo em Python: é como o `ruff`/`flake8`.
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Código gerado automaticamente pelo Prisma (não editamos à mão).
    "src/generated/**",
  ]),
]);

export default eslintConfig;
