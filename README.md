# Concurso TI — plataforma de cursos de TI para concursos

Plataforma de cursos que ensina Informática/TI para candidatos de concursos que **não são da
área de TI**. Visão, regras de negócio, stack e roteiro estão em **[PROJECT.md](./PROJECT.md)**
(leia primeiro).

**Estado atual:** Fase 1 concluída — projeto, banco, autenticação e perfis.

---

## 1. Rodando na sua máquina (primeira vez)

Pré-requisitos: **Node.js 22 ou mais novo** ([nodejs.org](https://nodejs.org)) e uma conta na
**[Neon](https://neon.tech)** (PostgreSQL gratuito).

```bash
# 1. Baixe o projeto e instale as dependências
#    (o "install" também gera o cliente do Prisma automaticamente)
git clone https://github.com/felipeyamate/site_concurso_ti.git
cd site_concurso_ti
npm install

# 2. Crie seu arquivo de configuração a partir do modelo
cp .env.example .env.local
#    Abra o .env.local e preencha (as instruções estão lá dentro):
#    - DATABASE_URL e DIRECT_URL (Neon → Dashboard → Connect)
#    - BETTER_AUTH_SECRET  (gere com: openssl rand -base64 32)
#    O resto pode ficar vazio por enquanto.

# 3. Crie as tabelas no banco
npm run db:deploy

# 4. Suba o site
npm run dev
```

Abra **http://localhost:3000**.

> Sem `RESEND_API_KEY`, nenhum e-mail é enviado: o conteúdo aparece **no terminal** onde o
> `npm run dev` está rodando (com o link clicável). Isso é o esperado em desenvolvimento.

### Criando o primeiro administrador

O perfil não pode ser escolhido no cadastro (por segurança). Para virar ADMIN:

1. Cadastre-se normalmente em http://localhost:3000/cadastro.
2. No terminal, rode: `npm run user:set-role -- seu@email.com ADMIN`
3. Acesse http://localhost:3000/admin.

O script altera o banco da `DATABASE_URL` do seu `.env.local`.

---

## 2. Como testar a Fase 1 (passo a passo)

Com o `npm run dev` rodando:

| # | Faça isto | O esperado |
|---|---|---|
| 1 | Abra http://localhost:3000/area-do-aluno sem estar logado | Vai para `/entrar?voltar=/area-do-aluno` |
| 2 | Em `/cadastro`, clique em "Criar conta" com tudo vazio | Mensagens de erro embaixo de cada campo |
| 3 | Cadastre-se com nome, e-mail e senha (8+ caracteres) | Cai na área do aluno, com o perfil "Aluno" e o aviso "Confirme seu e-mail" |
| 4 | Veja o terminal do `npm run dev` | Aparece o e-mail de confirmação com o link. Abra o link: o aviso some |
| 5 | Acesse http://localhost:3000/admin como aluno | "Página não encontrada" (404) |
| 6 | Clique em "Sair" e tente entrar com a senha errada | "E-mail ou senha incorretos." |
| 7 | **Limite de dispositivos:** entre com a mesma conta em 3 navegadores diferentes (ex.: Chrome, Chrome anônimo e Firefox) | No 3º login, o 1º navegador é deslogado (ao recarregar, vai para o login). A lista "Dispositivos conectados" mostra 2 |
| 8 | Em "Dispositivos conectados", clique em "Desconectar" no outro dispositivo | O outro navegador é deslogado |
| 9 | Em `/entrar`, digite o e-mail e clique em "Receber link de acesso por e-mail" | O link aparece no terminal; ao abrir, você entra sem senha. Abrir o mesmo link de novo dá "link inválido ou já usado" |
| 10 | Em `/esqueci-senha`, peça a redefinição e abra o link do terminal | Tela de nova senha. Depois de trocar, os outros dispositivos são deslogados e a senha nova funciona |
| 11 | Rode `npm run user:set-role -- seu@email.com ADMIN` e abra `/admin` | Painel admin com a tabela de usuários |
| 12 | Tente `/entrar?voltar=https://google.com` e faça login | Você vai para `/area-do-aluno`, nunca para outro site |

**Login com Google** (opcional): preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no
`.env.local` (instruções no `.env.example`) e reinicie o `npm run dev`. O botão "Continuar com
Google" aparece no login e no cadastro.

---

## 3. Comandos do dia a dia

| Comando | Para que serve |
|---|---|
| `npm run dev` | Sobe o site em modo desenvolvimento (recarrega sozinho ao salvar arquivos) |
| `npm run build` | Gera a versão de produção (a Vercel roda isto a cada deploy) |
| `npm run lint` | Procura problemas comuns no código |
| `npm run typecheck` | Checa os tipos do TypeScript (como o `mypy`) |
| `npm test` | Testes unitários (rápidos, sem banco) |
| `npm run test:integration` | Testes com banco de verdade (ver seção 4) |
| `npm run db:migrate -- --name descricao` | Depois de **alterar** `prisma/schema.prisma`: cria e aplica uma nova migração |
| `npm run db:deploy` | Aplica migrações já existentes (primeira vez, produção) |
| `npm run db:studio` | Abre uma interface visual para ver/editar os dados do banco |
| `npm run user:set-role -- email PERFIL` | Muda o perfil de um usuário (STUDENT, TEACHER, ADMIN) |

---

## 4. Testes automáticos

- **Unitários** (`npm test`): regras puras — perfis, limite de sessões, proteção de redirecionamento,
  validação de formulários, variáveis de ambiente, e-mails.
- **Integração** (`npm run test:integration`): cadastro, login e limite de sessões gravando num
  PostgreSQL de verdade. **Os testes apagam os dados do banco que usam**, por isso exigem um banco
  SEPARADO na variável `TEST_DATABASE_URL`:
  1. Na Neon, crie uma branch chamada `test` (Branches → New branch).
  2. Copie a string de conexão **direta** dessa branch.
  3. Adicione ao `.env.local`: `TEST_DATABASE_URL="postgresql://..."`
  4. Rode `npm run test:integration`. (Os testes se recusam a rodar se esse banco for o mesmo da `DATABASE_URL`.)
- **CI:** a cada push/PR, o GitHub Actions roda lint, tipos, os dois tipos de teste e o build
  (`.github/workflows/ci.yml`), com um PostgreSQL temporário.

---

## 5. Onde fica cada coisa

```
prisma/
  schema.prisma          Tabelas do banco (como os models.py do Django/SQLAlchemy)
  migrations/            Histórico de alterações do banco (SQL gerado pelo Prisma)
scripts/set-role.ts      Script para mudar perfil de usuário
src/
  app/                   Páginas e rotas (cada pasta = um endereço do site)
    (auth)/              /entrar, /cadastro, /esqueci-senha, /redefinir-senha
    area-do-aluno/       Área do aluno (exige login)
    admin/               Painel admin (exige perfil TEACHER ou ADMIN)
    api/auth/[...all]/   API de autenticação (/api/auth/*)
  components/ui/         Componentes visuais (shadcn/ui)
  lib/                   Utilidades gerais: banco (db.ts), configurações (env.ts)
  modules/               Domínios do sistema ("monolito modular")
    auth/                Contas: login, perfis, sessões
    email/               Envio de e-mails e modelos de texto
  proxy.ts               Barreira rápida das áreas protegidas
  generated/prisma/      Cliente do banco GERADO pelo Prisma (não editar; fora do Git)
tests/integration/       Testes que usam o banco de verdade
```

---

## 6. Publicando na Vercel (quando for a hora)

1. Na Vercel: **Add New → Project** e importe este repositório do GitHub.
2. Em **Settings → Environment Variables**, cadastre as mesmas variáveis do `.env.example`,
   com valores de produção (`BETTER_AUTH_URL` = endereço do site, `BETTER_AUTH_SECRET` novo,
   `RESEND_API_KEY` obrigatória).
3. Antes do primeiro deploy (e sempre que houver migração nova), aplique as migrações no banco
   de produção: `DIRECT_URL="<url direta de produção>" npm run db:deploy`.
4. Se usar Google: cadastre `https://SEU-DOMINIO/api/auth/callback/google` como URI de
   redirecionamento no Google Cloud Console.
