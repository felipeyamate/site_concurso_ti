# Como testar e revisar um PR

Guia para o dono do projeto revisar o que o Claude (ou qualquer pessoa) entregar. Vale para
todas as fases. Você **não precisa entender cada linha de código**: a sua revisão mais valiosa é
conferir se o comportamento e as decisões fazem sentido para o negócio.

**O caminho de uma mudança:**
branch → PR (pull request) → CI (verificação automática) → sua revisão → merge na `main` →
(quando a Vercel estiver ligada) o site é publicado sozinho.

---

## Passo 1 — Veja se o CI passou (1 minuto)

No PR, role até o fim da aba **Conversation**. Os "checks" aparecem ali:

- ✅ **verde**: lint, tipos, testes e build passaram.
- ❌ **vermelho**: clique em **Details** para ver o erro, e peça ao Claude para corrigir.
  Não faça merge com o CI vermelho.
- 🟡 **amarelo**: ainda está rodando (leva uns 3 a 5 minutos).

## Passo 2 — Leia a descrição e as decisões (10 minutos) ⭐ o mais importante

1. Leia a descrição do PR: o que foi feito, como testar e por onde revisar.
2. Abra o `PROJECT.md` na aba **Files changed** e leia as linhas novas das seções **8 (decisões)**
   e **10 (entregas e pendências)**.
3. Pergunte-se, para cada decisão:
   - Isso faz sentido para o meu aluno? (ex.: "limite de 2 dispositivos" é bom ou pouco?)
   - Isso bate com o modelo de negócio (seção 2) e com as regras que não mudam (seção 6)?
   - Tem alguma "decisão pendente" esperando por mim?

Discordou de algo? Comente no PR (veja o passo 4) ou peça direto ao Claude. É muito mais barato
mudar agora do que depois.

## Passo 3 — Teste na sua máquina (20 a 30 minutos)

**Primeira vez** (preparar o computador): siga a seção 1 do [`README.md`](../README.md)
(Node.js, `npm install`, `.env.local`, `npm run db:deploy`).

**Para testar um PR** (a branch do PR aparece no topo dele, ex.: `claude/bold-darwin-mfux9m`):

```bash
git fetch origin
git checkout claude/bold-darwin-mfux9m   # troque pelo nome da branch do PR
npm install                              # instala o que for novo
npm run db:deploy                        # aplica migrações novas no SEU banco de desenvolvimento
npm run dev                              # abra http://localhost:3000
```

Depois:

1. Siga o roteiro **"Como testar"** do README (a tabela com "Faça isto → O esperado").
   Marque o que passou e anote o que não passou (com o número do passo).
2. Os e-mails (confirmação, link mágico, senha) aparecem **no terminal** do `npm run dev`.
   Serviços externos que você ainda não configurou (Panda, R2) têm substitutos de desenvolvimento
   ou avisos claros — o README diz, em cada fase, o que dá para testar sem conta.
3. Teste também do jeito "errado", como um aluno confuso faria: campos vazios, senha curta,
   voltar no navegador, abrir o mesmo link duas vezes, usar o celular.
4. Rode os testes automáticos:
   ```bash
   npm test                   # rápidos, sem banco
   npm run test:integration   # precisa de TEST_DATABASE_URL no .env.local (branch "test" da Neon)
   ```

Para voltar à versão principal depois: `git checkout main && git pull`.

## Passo 4 — Olhe o código no GitHub (15 minutos, sem pressa)

Na aba **Files changed**:

1. Siga a ordem sugerida em "Por onde revisar" na descrição do PR (do mais importante para o menos).
2. Arquivos grandes e gerados (`package-lock.json`, `.claude/skills/...`, migrações `.sql`)
   podem ser pulados: marque **Viewed** para escondê-los.
3. O que conferir, mesmo sem saber TypeScript:
   - [ ] Todo arquivo começa com um comentário explicando o que faz, quem chama e o que devolve.
   - [ ] Os comentários explicam o **porquê**, e você entende a ideia geral.
   - [ ] As mensagens que o aluno vê (textos entre aspas nas telas) estão claras e sem erros.
   - [ ] As regras de negócio do código batem com o `PROJECT.md` (ex.: `MAX_ACTIVE_SESSIONS = 2`).
   - [ ] Nenhuma senha, chave de API ou dado pessoal real no código (tudo isso só no `.env.local`).
   - [ ] Os testes (`*.test.ts`) descrevem comportamentos que você espera. Leia só as frases
         dentro de `it("...")`: elas estão em português e funcionam como uma lista de regras.
4. Para comentar: passe o mouse na linha, clique no **+** azul, escreva e clique em
   **Start a review** (junta vários comentários) ou **Add single comment**.
   Perguntas como "não entendi por que isso existe" são ótimas: o Claude explica ou melhora o comentário.

## Passo 5 — Decida e faça o merge

1. Clique em **Review changes** (canto superior direito da aba Files changed) e envie seus comentários.
   Como o PR foi aberto com a sua conta, o GitHub não deixa você "aprovar" o próprio PR. Isso é normal.
2. Se pediu mudanças: peça ao Claude para tratar os comentários. Ele responde em cada um e envia
   as correções. Repita os passos 1 a 4 só no que mudou.
3. Tudo certo? Na aba **Conversation**, clique em **Squash and merge** (junta os commits do PR num
   só na `main`, o que deixa o histórico fácil de ler) e depois em **Delete branch**.
4. Depois do merge (quando o site estiver na Vercel): se o PR trouxe migração nova
   (`prisma/migrations/...`), aplique no banco de produção: `DIRECT_URL="<url de produção>" npm run db:deploy`.

---

## Checklist rápido (copie num comentário do PR, se quiser)

```
- [ ] CI verde
- [ ] Li as decisões novas do PROJECT.md e concordo (ou comentei)
- [ ] Rodei a branch localmente e segui o roteiro "Como testar" do README
- [ ] Testei casos "errados" (campos vazios, links repetidos, celular)
- [ ] `npm test` passou na minha máquina
- [ ] Olhei os arquivos principais indicados no PR
- [ ] Nenhum segredo no código
```
