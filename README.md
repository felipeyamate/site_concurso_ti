# Concurso TI — plataforma de cursos de TI para concursos

Plataforma de cursos que ensina Informática/TI para candidatos de concursos que **não são da
área de TI**. Visão, regras de negócio, stack e roteiro estão em **[PROJECT.md](./PROJECT.md)**
(leia primeiro).

**Estado atual:** Fase 3 concluída — painel admin para cadastrar cursos, módulos, aulas, vídeos do
Panda Video e PDFs (Cloudflare R2), e para gerenciar perfis e matrículas. (Fase 1: projeto, banco,
login e perfis. Fase 2: catálogo, player, matrículas e progresso.)

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

# 4. Crie o curso de EXEMPLO (dados de desenvolvimento; nunca rode no banco de produção)
npm run db:seed

# 5. Suba o site
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
| 11 | Rode `npm run user:set-role -- seu@email.com ADMIN` e abra `/admin` | Painel admin; a lista de usuários fica no menu "Usuários" |
| 12 | Tente `/entrar?voltar=https://google.com` e faça login | Você vai para `/area-do-aluno`, nunca para outro site |
| 13 | Saia e, em `/entrar`, peça um link mágico com um e-mail **que ainda não tem conta** | Ao abrir o link, a conta é criada com um nome tirado do e-mail (ex.: `ana.lima@...` → "Ana Lima") e aparece o aviso "Sua conta não tem senha" |
| 14 | No aviso, clique em "Criar uma senha" e siga o e-mail | Depois de criar, você entra com e-mail e senha e o aviso some |

**Login com Google** (opcional): preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no
`.env.local` (instruções no `.env.example`) e reinicie o `npm run dev`. O botão "Continuar com
Google" aparece no login e no cadastro.

**Revisando um PR?** O guia completo (como rodar a branch do PR, o que olhar no código e como aprovar)
está em [`docs/COMO-REVISAR.md`](./docs/COMO-REVISAR.md).

---

## 3. Como testar a Fase 2 (passo a passo)

Pré-requisito: ter rodado `npm run db:seed` (cria o "Curso Base" de exemplo, com 16 aulas, e um
curso em rascunho). As aulas do seed usam um vídeo de exemplo (desenho "Big Buck Bunny"), que só
toca com `npm run dev` (em produção o vídeo de exemplo é bloqueado de propósito). Aulas de verdade
usam o Panda Video (Fase 3).

| # | Faça isto | O esperado |
|---|---|---|
| 1 | Sem estar logado, abra http://localhost:3000/cursos | Aparece o "Informática e TI para Concursos — do zero". O curso "TI para o Banco do Brasil" (rascunho) **não** aparece |
| 2 | Abra o curso | 7 módulos e 16 aulas; cadeado 🔒 nas aulas pagas, etiqueta "Grátis" em 2 aulas e o botão "Assistir aula grátis" |
| 3 | Clique em "Assistir aula grátis" | Pede login. Depois de entrar (ou criar conta), você volta direto para a aula grátis, com o vídeo e o **seu e-mail** passeando por cima do vídeo (marca d'água) |
| 4 | Assista uns 30 segundos, pause e recarregue a página (F5) | O vídeo continua de onde parou e aparece "Continuando de onde você parou" |
| 5 | Arraste o vídeo até o fim | A aula vira "Concluída" e ganha ✓ na lista da direita |
| 6 | Abra uma aula com cadeado | "Aula bloqueada — exclusiva para alunos matriculados", **sem vídeo** |
| 7 | No terminal: `npm run enroll -- seu@email.com informatica-e-ti-do-zero 365` e recarregue | A aula abre (matrícula de 365 dias). Rodar de novo **soma** mais 365 dias ao que faltava |
| 8 | Clique em "Próxima: …" e depois em "Marcar como concluída" | Vai para a aula seguinte; o botão vira "Concluída (desmarcar)" e o % do curso sobe. "Desmarcar" vale mesmo com o vídeo perto do fim |
| 9 | Abra http://localhost:3000/area-do-aluno | "Meus cursos" mostra o curso com o % e o botão "Continuar: <próxima aula pendente>". Depois do passo 10, o curso continua na lista, explicando que o acesso foi cancelado |
| 10 | `npm run enroll -- seu@email.com informatica-e-ti-do-zero --revogar` e abra uma aula paga | "Seu acesso a este curso foi cancelado" (também na página do curso). A aula grátis continua abrindo |
| 11 | `npm run user:set-role -- seu@email.com TEACHER` e abra `/cursos` | Aparece também o rascunho (etiqueta "Rascunho") e todas as aulas abrem, sem matrícula |
| 12 | Abra as páginas no celular (ou no modo celular do navegador: F12 → ícone de celular) | Nada "vaza" para os lados; o player ocupa a largura da tela |

---

## 4. Como testar a Fase 3 (passo a passo)

Pré-requisitos: uma conta ADMIN (seção 1), uma conta de aluno (cadastre-se num navegador anônimo)
e o `npm run dev` rodando. **Não precisa de conta no Panda nem no R2 para testar**: sem o R2, os PDFs
vão para a pasta `.data/uploads`; sem o Panda, dá para testar o cadastro com um link de exemplo
(o player não carrega, mas todo o resto funciona). Para testar com vídeos de verdade, veja
"Configurando o Panda Video" logo abaixo.

| # | Faça isto | O esperado |
|---|---|---|
| 1 | Como ADMIN, abra http://localhost:3000/admin | Menu "Visão geral · Cursos · Usuários" e o quadro "Integrações" dizendo o que está configurado (Panda, PDFs) |
| 2 | Em **Cursos**, crie o curso "Meu curso de teste" | Abre a página do curso, como **Rascunho**. Em `/cursos` (navegador anônimo) ele ainda não aparece |
| 3 | Adicione os módulos "Módulo 1" e "Módulo 2"; no Módulo 1, adicione a aula "Primeira aula" | A aula abre para edição, como rascunho e "Sem vídeo" |
| 4 | Na aula: marque "Publicada", salve. Em **Vídeo**, escolha "Panda Video" e cole `https://www.youtube.com/watch?v=x` | Erro: "O link precisa ser do player do Panda" |
| 5 | Cole o link do player de um vídeo seu do Panda (ou, sem conta, `https://player-vz-teste.tv.pandavideo.com.br/embed/?v=9988aabb-ccdd-eeff-1122-334455667788`), preencha a duração e salve | "Vídeo salvo." (o código `<iframe>` inteiro do Panda também é aceito) |
| 6 | Em **Materiais (PDF)**, tente enviar um arquivo que não é PDF; depois envie um PDF com o título "Resumo" | O primeiro é recusado; o PDF aparece na lista |
| 7 | Volte ao curso: crie outra aula, use as setas ↑↓ e tente apagar o "Módulo 1" | A ordem muda; o módulo com aulas **não** é apagado ("O módulo ainda tem aulas") |
| 8 | Nos dados do curso, marque "Publicado" e salve | O curso aparece em `/cursos` para o aluno |
| 9 | Como aluno, abra a "Primeira aula" | "Aula bloqueada" (sem matrícula), sem vídeo e sem PDF |
| 10 | Como ADMIN, em **Usuários**, busque o aluno → "Gerenciar" → Matricular no curso com 30 dias | "Matriculado em ... (até dd/mm/aaaa)" e a matrícula "Ativa" na tabela |
| 11 | Como aluno, recarregue a aula | Player do Panda + "Material da aula" com o PDF. Clicar no PDF abre o arquivo (o link real vale só 5 minutos) |
| 12 | Com o Panda configurado: assista um pouco, pause e recarregue | Continua de onde parou; ao terminar o vídeo, a aula fica "Concluída". Com o DRM configurado, o nome/e-mail do aluno aparecem **dentro** do vídeo (inclusive em tela cheia) |
| 13 | Como ADMIN, clique em "Revogar" na matrícula; como aluno, clique de novo no link do PDF | Volta para a aula com "Seu acesso a este curso foi cancelado" |
| 14 | Como ADMIN, tente apagar a aula que o aluno assistiu | O botão fica desativado: "despublique em vez de apagar" (o histórico do aluno nunca é apagado) |
| 15 | Em **Usuários**, mude o perfil do aluno para Professor e abra o seu próprio usuário | O perfil muda; o seu próprio perfil fica travado (só outro admin muda) |
| 16 | Como Professor, abra `/admin/usuarios` | "Página não encontrada": professor gerencia cursos, não usuários |

### Configurando o Panda Video

1. Crie a conta em [pandavideo.com.br](https://pandavideo.com.br) e envie um vídeo.
2. **Link do player:** no vídeo → "Incorporar" (embed) → copie o link (ou o código `<iframe>` inteiro) e
   cole na aula, no painel. Pronto: a aula já toca (em desenvolvimento).
3. **Biblioteca no painel (opcional):** Panda → Configurações → API → copie a chave para
   `PANDA_API_KEY` no `.env.local`. Na aula aparece "Buscar no Panda", que preenche o link e a duração.
4. **Marca d'água DRM (obrigatória em produção):** Panda → Segurança → DRM → crie um grupo e, em
   "Integrar DRM" → API, copie o ID do grupo (`PANDA_DRM_GROUP_ID`) e o segredo (`PANDA_DRM_SECRET`).
5. **Domínios permitidos:** no Panda, restrinja a exibição dos vídeos ao domínio do site
   (e `localhost` enquanto testa). Assim o player não toca se alguém copiar o link para outro site.
6. Reinicie o `npm run dev` depois de mudar o `.env.local`. O quadro "Integrações" em `/admin` confirma.

> A integração segue a documentação pública do Panda (player por `<iframe>`, eventos `panda_*` por
> `postMessage`, DRM via token JWT). Como o ambiente de desenvolvimento do Claude não acessa o Panda,
> **a primeira aula real deve ser conferida por você** (passo 12 acima): se o "continuar de onde parou"
> ou a marca d'água não funcionarem, avise — o ajuste fica em `src/modules/video/panda/`.

### Configurando o Cloudflare R2 (PDFs)

1. Na Cloudflare: **R2 → Create bucket** (ex.: `concurso-ti-materiais`). Deixe o bucket **privado**.
2. **R2 → Manage API tokens → Create API token** com permissão "Object Read & Write" só nesse bucket.
   Copie o *Access Key ID* e o *Secret Access Key* (aparecem uma vez só) e o *Account ID*.
3. No bucket → **Settings → CORS policy**, cole (troque pelo endereço do seu site):
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://SEU-DOMINIO"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   (Sem isso, o navegador não consegue enviar o PDF: aparece "confira também o CORS do bucket".)
4. Preencha `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_BUCKET` no `.env.local`
   (e na Vercel) e reinicie o site.

---

## 5. Comandos do dia a dia

| Comando | Para que serve |
|---|---|
| `npm run dev` | Sobe o site em modo desenvolvimento (recarrega sozinho ao salvar arquivos) |
| `npm run build` | Gera a versão de produção (a Vercel roda isto a cada deploy) |
| `npm run lint` | Procura problemas comuns no código |
| `npm run typecheck` | Checa os tipos do TypeScript (como o `mypy`) |
| `npm test` | Testes unitários (rápidos, sem banco) |
| `npm run test:integration` | Testes com banco de verdade (ver seção 6) |
| `npm run db:migrate -- --name descricao` | Depois de **alterar** `prisma/schema.prisma`: cria e aplica uma nova migração |
| `npm run db:deploy` | Aplica migrações já existentes (primeira vez, produção) |
| `npm run db:studio` | Abre uma interface visual para ver/editar os dados do banco |
| `npm run db:seed` | Grava o curso de exemplo (só desenvolvimento; pode rodar várias vezes) |
| `npm run user:set-role -- email PERFIL` | Muda o perfil de um usuário (STUDENT, TEACHER, ADMIN). No dia a dia, use o painel (/admin/usuarios); o script serve para criar o primeiro ADMIN |
| `npm run enroll -- email curso [dias \| --revogar]` | Matricula num curso (sem data de fim ou por N dias), renova, ou revoga o acesso — o mesmo que o painel faz |

---

## 6. Testes automáticos

- **Unitários** (`npm test`): regras puras — perfis, limite de sessões, proteção de redirecionamento,
  validação de formulários, variáveis de ambiente, e-mails, **acesso às aulas** (matrícula),
  progresso, "continuar de onde parou", link e mensagens do player do Panda, token da marca d'água,
  links assinados dos PDFs e as travas de perfil.
- **Integração** (`npm run test:integration`): cadastro, login, limite de sessões, seed do catálogo,
  acesso às aulas, progresso, painel de cursos (criar, reordenar, apagar com proteção), envio e
  download de PDFs, matrículas e perfis, gravando num PostgreSQL de verdade. **Os testes apagam os dados do banco que usam**, por isso exigem um banco
  SEPARADO na variável `TEST_DATABASE_URL`:
  1. Na Neon, crie uma branch chamada `test` (Branches → New branch).
  2. Copie a string de conexão **direta** dessa branch.
  3. Adicione ao `.env.local`: `TEST_DATABASE_URL="postgresql://..."`
  4. Rode `npm run test:integration`. (Os testes se recusam a rodar se esse banco for o mesmo da `DATABASE_URL`.)
- **CI:** a cada push/PR, o GitHub Actions roda lint, tipos, os dois tipos de teste e o build
  (`.github/workflows/ci.yml`), com um PostgreSQL temporário.

---

## 7. Onde fica cada coisa

```
prisma/
  schema.prisma          Tabelas do banco (como os models.py do Django/SQLAlchemy)
  migrations/            Histórico de alterações do banco (SQL gerado pelo Prisma)
  seed.ts, seed-catalog.ts  Curso de EXEMPLO para desenvolvimento (npm run db:seed)
scripts/                 set-role.ts (perfil) e enroll.ts (matrícula)
src/
  app/                   Páginas e rotas (cada pasta = um endereço do site)
    (auth)/              /entrar, /cadastro, /esqueci-senha, /redefinir-senha
    area-do-aluno/       Área do aluno: meus cursos, dispositivos (exige login)
    cursos/              /cursos (catálogo), /cursos/[curso], /cursos/[curso]/aulas/[aula] (player)
                         e .../materiais/[id] (download do PDF, confere o acesso a cada clique)
    admin/               Painel: visão geral, cursos/[id]/aulas/[id] (TEACHER+), usuarios/[id] (ADMIN)
    api/auth/[...all]/   API de autenticação (/api/auth/*)
    api/dev-storage/     Envio/download de PDFs SEM o R2 (só desenvolvimento)
  components/ui/         Componentes visuais (shadcn/ui)
  components/admin/      Peças comuns do painel (menu, botões de ação, mensagens dos formulários)
  lib/                   Utilidades gerais: banco (db.ts), configurações (env.ts), formulários (form-state.ts)
  modules/               Domínios do sistema ("monolito modular")
    auth/                Contas: login, perfis, sessões; perfis pelo painel (admin-*)
    catalog/             Cursos, módulos e aulas; admin/ = cadastro pelo painel
    enrollment/          Matrículas, a REGRA DE ACESSO às aulas (access.ts) e matricular/revogar (grant.ts)
    progress/            Progresso, conclusão, "continuar de onde parou", player da aula
    video/               Fornecedores de vídeo (exemplo e panda/) e os players
    materials/           PDFs das aulas: envio, lista, download
    storage/             Armazenamento de arquivos: Cloudflare R2 ou pasta local (desenvolvimento)
    email/               Envio de e-mails e modelos de texto
  proxy.ts               Barreira rápida das áreas protegidas
  generated/prisma/      Cliente do banco GERADO pelo Prisma (não editar; fora do Git)
tests/integration/       Testes que usam o banco de verdade
```

---

## 8. Publicando na Vercel (quando for a hora)

1. Na Vercel: **Add New → Project** e importe este repositório do GitHub.
2. Em **Settings → Environment Variables**, cadastre as mesmas variáveis do `.env.example`,
   com valores de produção (`BETTER_AUTH_URL` = endereço do site, `BETTER_AUTH_SECRET` novo,
   `RESEND_API_KEY` obrigatória, `PANDA_DRM_*` obrigatórias para os vídeos tocarem e `R2_*` para os PDFs).
3. Antes do primeiro deploy (e sempre que houver migração nova), aplique as migrações no banco
   de produção: `DIRECT_URL="<url direta de produção>" npm run db:deploy`.
4. Se usar Google: cadastre `https://SEU-DOMINIO/api/auth/callback/google` como URI de
   redirecionamento no Google Cloud Console.
