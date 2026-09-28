// neon.ts — configuração "como código" do Neon (nosso banco PostgreSQL).
//
// O que é: aqui declaramos quais serviços do Neon o projeto usa e regras por branch
// (branch = cópia do banco, como uma branch do git, só que dos dados).
//
// Por enquanto está vazio de propósito: usamos só o Postgres padrão do projeto.
// Quem lê este arquivo: o comando `neon deploy` (e `neon config plan/apply`).
import { defineConfig } from "@neon/config/v1";

export default defineConfig({});
