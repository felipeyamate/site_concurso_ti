# Concurso TI — plataforma de cursos de TI para concursos

Plataforma de cursos que ensina Informática/TI para candidatos de concursos que **não são da
área de TI**. Visão, regras de negócio, stack e roteiro estão em **[PROJECT.md](./PROJECT.md)**
(leia primeiro).

**Estado atual:** Fase 5 concluída — banco de questões: questões comentadas com filtros (banca, assunto,
prova, tipo), simulados com tempo de prova, "meu desempenho" por assunto e o mapa público "o que mais
cai" por banca; o professor cadastra questões pelo painel ou importa uma planilha (CSV). Quem não tem
curso nem assinatura resolve 10 questões grátis por dia. (Fase 1: projeto, banco, login e perfis. Fase 2:
catálogo, player, matrículas e progresso. Fase 3: painel admin, Panda Video e PDFs. Fase 4: vendas com o
Asaas — Pix, boleto, cartão, assinaturas, reembolso e nota fiscal.)

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

# 4. Crie o curso e as questões de EXEMPLO (dados de desenvolvimento; nunca rode no banco de produção)
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

## 5. Como testar a Fase 4 (passo a passo)

Pré-requisitos: uma conta ADMIN (seção 1), duas contas de aluno (navegadores anônimos), o seed
(`npm run db:seed`) e o `npm run dev` rodando. **Não precisa de conta no Asaas**: sem `ASAAS_API_KEY`,
os pagamentos são SIMULADOS — a "página de pagamento do Asaas" vira o simulador
`/dev/pagamentos/...`, com botões que fazem o papel do Asaas (pagar, estornar, contestar). Os avisos
simulados passam pelo MESMO código dos avisos reais. Para testar com o Asaas de verdade (sandbox), veja
"Configurando o Asaas" logo abaixo.

CPFs de teste (válidos na conta, não pertencem a ninguém): `529.982.247-25`, `111.444.777-35`, `935.411.347-80`.

| # | Faça isto | O esperado |
|---|---|---|
| 1 | Como ADMIN, abra `/admin` → **Vendas** | "Provedor de pagamento: Simulado (desenvolvimento)" e os números zerados |
| 2 | **Produtos** → crie "Curso Base — 12 meses", preço `197,00`, 365 dias, 12 parcelas | Abre o produto **inativo**. Marque "Ativo" sem marcar curso e salve: erro "Marque pelo menos um curso" |
| 3 | Marque o curso "Informática e TI para Concursos — do zero" e "Ativo"; salve | "Produto salvo." |
| 4 | **Planos** → em "Cursos incluídos na assinatura", marque o mesmo curso e salve; crie o plano "Assinatura mensal", `49,90`, Mensal, e ative | "Cursos da assinatura salvos"; "Plano salvo." |
| 5 | Num navegador anônimo, abra `/cursos/informatica-e-ti-do-zero` | Ofertas: "R$ 197,00 · ou até 12x de R$ 16,42 sem juros · acesso por 1 ano" e o quadro da assinatura. "Comprar" pede login |
| 6 | Como aluno, clique em "Comprar". Envie com CPF `111.111.111-11` e sem aceitar os termos | Erros no CPF e nos termos (o que foi digitado continua) |
| 7 | CPF `529.982.247-25`, Pix, aceite os termos, "Ir para o pagamento" | Página do Pix com o QR Code "PIX SIMULADO", o "copia e cola" e "Aguardando pagamento". Uma aula paga continua bloqueada |
| 8 | Clique em "Abra a fatura" (abre o simulador) → "Pagar (aprovar)". Volte à aba do pagamento | Em até 5 s: "Pagamento confirmado!". A aula paga abre. No terminal: o e-mail "Pagamento confirmado" |
| 9 | Área do aluno → **Minhas compras** → "Pedir reembolso" | Pedido "Reembolso em andamento" e o acesso sai **na hora** (a aula mostra "acesso cancelado"). No simulador, "Concluir estorno" → pedido "Reembolsado" |
| 10 | Com a 2ª conta: compre no **Cartão de crédito** em 3x | Página com "3x de R$ 65,67" e "Pagar com cartão" (no Asaas real, a página segura dele). No simulador, "Pagar (aprovar)" → acesso liberado |
| 11 | Com a 1ª conta: `/planos` → "Assinar" → **Boleto** → "Abrir o boleto" (simulador) → "Pagar (aprovar)" | Em Minhas compras: assinatura "Ativa" e "Acesso garantido até <vencimento + 1 mês + 5 dias de tolerância>" (vale o dia inteiro) |
| 12 | No simulador da assinatura, "Gerar a cobrança do próximo ciclo"; em Minhas compras, "Pagar" → simulador → "Pagar (aprovar)" | A data de "acesso garantido" avança 1 mês |
| 13 | "Cancelar assinatura" | Assinatura "Cancelada". A data de "acesso garantido" passa para a **véspera do próximo vencimento** (sem os 5 dias de tolerância: não há mais pagamento para esperar) e o acesso continua até lá |
| 14 | Como ADMIN: **Pedidos** → abra o pedido da 2ª conta → "Reembolsar pedido" | Pedido em reembolso e a aula volta a ficar bloqueada para a 2ª conta |
| 15 | **Avisos do provedor** | Cada aviso (pago, estorno...) com o que foi feito. Em **Usuários** → aluno: quadro "Compras" |
| 16 | Matricule a 2ª conta manualmente (Usuários) e revogue | Só a matrícula manual muda: compra e assinatura têm a própria linha ("Origem") |
| 17 | Abra `/admin/vendas` e `/area-do-aluno/pagamentos/<id de outra pessoa>` com um aluno | "Página não encontrada" nos dois |
| 18 | Compre com **Boleto**, pague no simulador e peça o reembolso em Minhas compras | "Reembolso em andamento" e a aula bloqueada. No painel, o pedido avisa "Estorno de boleto pendente" |
| 19 | No simulador desse boleto, clique **"Pagar (aprovar)" de novo** (é o que o Asaas mostraria até alguém fazer o estorno no painel dele) | A aula **continua bloqueada** e o aviso fica registrado como "estorno manual pendente". Depois, "Concluir estorno" → pedido "Reembolsado" |
| 20 | Assine com **Boleto**, pague no simulador e use "Cancelar e pedir reembolso" | Em `/admin/vendas`: "1 assinatura(s) com estorno de boleto para fazer no painel do Asaas". Na página da assinatura: aviso "Estorno de boleto pendente" e sem o botão "Cancelar e estornar" |

### Configurando o Asaas

1. **Sandbox (testes, dinheiro de mentira):** crie uma conta em [sandbox.asaas.com](https://sandbox.asaas.com)
   (é separada da conta de produção).
2. **Chave da API:** Integrações → Chaves de API → gerar. Cole em `ASAAS_API_KEY` (no `.env.local`) e deixe
   `ASAAS_ENVIRONMENT="sandbox"`.
3. **Webhook (os avisos de pagamento):** Integrações → Webhooks → Adicionar:
   - URL: `https://SEU-DOMINIO/api/webhooks/asaas` (o painel do site mostra o endereço exato em Vendas).
     Em `localhost` o Asaas não alcança a sua máquina: teste num deploy de preview da Vercel ou com um
     túnel (ex.: `npx cloudflared tunnel --url http://localhost:3000`).
   - Token de autenticação: gere com `openssl rand -hex 32` e use o MESMO valor em `ASAAS_WEBHOOK_TOKEN`.
   - Tipo de envio: **Sequencial**. Eventos: todos de **Cobranças**, **Assinaturas** e **Notas fiscais**.
4. **Domínio do site:** Minha conta → Informações → site. O Asaas só devolve o aluno ao site (depois do
   cartão) se o endereço for desse domínio.
5. Reinicie o site. Em Vendas deve aparecer "Asaas — sandbox (testes)". No sandbox, pague as cobranças
   pelo próprio painel do Asaas (ou com os cartões de teste da documentação do Asaas).
6. **Produção:** conta de produção aprovada, chave de produção, `ASAAS_ENVIRONMENT="production"` e um webhook
   de produção com outro token. Por segurança, o **site de produção com a chave do sandbox fica com as vendas
   desligadas** (no sandbox, cartões de teste "pagariam" de mentira).

> A integração segue a API v3 do Asaas (documentação pública e os formatos usados por SDKs conhecidos).
> Como o ambiente do Claude não acessa o Asaas, **confira no sandbox** o fluxo completo (passos 7 a 14 acima,
> pagando pelo painel do Asaas). Ajustes ficam em `src/modules/payments/provider/asaas/`.

### Nota fiscal (NFS-e) automática — opcional

1. No Asaas: Notas fiscais → configure os dados fiscais da empresa (inscrição municipal, certificado etc.).
2. Com o seu contador: o **serviço municipal** (código ou ID da lista do Asaas, ex.: `08.02` — instrução e
   treinamento) e a **alíquota do ISS**. O site manda só o ISS (sem retenção) e zera os demais impostos —
   o comum no Simples Nacional; confirme com o contador.
3. Preencha `NFSE_ENABLED="true"`, `NFSE_SERVICE_DESCRIPTION`, `NFSE_MUNICIPAL_SERVICE_CODE` (ou `_ID`),
   `NFSE_MUNICIPAL_SERVICE_NAME` e `NFSE_ISS_RATE`, e reinicie.
4. A nota é pedida quando o pagamento é confirmado e cancelada quando há reembolso/contestação. A situação
   aparece em Vendas → Pedidos (com "Emitir nota de novo" se a prefeitura recusar) e o PDF em "Minhas compras".

---

## 6. Como testar a Fase 5 (passo a passo)

Pré-requisitos: rode `npm run db:seed` de novo (agora ele grava também o **banco de questões de exemplo**:
4 bancas, 6 assuntos, 3 provas **fictícias** e 30 questões comentadas — pode rodar várias vezes, não
duplica), uma conta PROFESSOR ou ADMIN (seção 1) e duas contas de aluno (navegadores anônimos). Dê acesso
completo à 2ª conta com uma matrícula: `npm run enroll -- email-do-aluno-2 informatica-e-ti-do-zero`.

| # | Faça isto | O esperado |
|---|---|---|
| 1 | Sem login, abra `/o-que-mais-cai` (também no rodapé: "O que mais cai") | "O que mais cai de TI nos concursos", "3 provas, 24 questões" e os assuntos em ordem, com a % de cada um |
| 2 | Clique na aba **Cesgranrio** | "Segurança da Informação" em 1º: "40% · 4 questões". "Treinar" pede login e depois abre as questões desse assunto e dessa banca |
| 3 | Com a 1ª conta (sem curso): Área do aluno → **Treinar com questões** → "Resolver questões" | "Hoje você ainda tem 10 questões grátis" e os filtros (assunto, banca, prova, tipo, situação) |
| 4 | Antes de responder, veja o código da página (Ctrl+U) e procure um trecho do comentário do professor | Não aparece: o gabarito e o comentário só saem do servidor **depois** da resposta |
| 5 | Marque uma alternativa errada e clique em **Responder** | "Você errou. Gabarito: X.", o comentário do professor e "Restam 9 questões grátis hoje." Com "Tentar de novo", responda de novo |
| 6 | Filtre a banca **Cebraspe** | Questões de **Certo ou errado** (opções "Certo" e "Errado") |
| 7 | Situação **"Que errei"** | Só as questões que você errou e ainda **não** acertou |
| 8 | Responda até acabar a cota do dia (10 respostas, contando as repetidas) | "Suas questões grátis de hoje acabaram" com o link "Ver planos"; a próxima resposta é recusada. A cota volta à meia-noite (Brasília) |
| 9 | Abra `/simulados` com a 1ª conta | "Simulados são para alunos" e o convite para os planos |
| 10 | Com a 2ª conta (matriculada): `/simulados` → Banca **Cesgranrio (10)**, 10 questões, "Sem limite de tempo" → **Começar simulado** | As 10 questões, sem gabarito. Responda 3 e recarregue a página: "3 de 10 respondidas" (salva a cada clique). Em "Resolver questões", a banca Cesgranrio mostra "0 questões encontradas" até você finalizar (senão o gabarito sairia antes) |
| 11 | **Finalizar simulado** | Pergunta "Ainda há 7 questão(ões) em branco...". Confirme: nota "X de 10 (Y%)", "7 em branco (contam como erro).", acertos por assunto e a correção com o comentário de cada questão |
| 12 | Novo simulado com **Tempo de prova** de 15 minutos | O relógio "Tempo restante" corre. Ao zerar, o simulado é finalizado sozinho (as respostas marcadas valem) |
| 13 | Área do aluno → **Meu desempenho** | Total de respostas, taxa de acerto, a tabela por assunto e os últimos simulados. Com 5+ respostas num assunto e menos de 60% de acerto, ele aparece em "Seus pontos fracos" |
| 14 | Como PROFESSOR: `/admin` → **Questões** → **Nova questão**; preencha sem escolher o gabarito e clique em "Criar questão" | Erro "O gabarito precisa ser uma das alternativas." e o texto digitado continua |
| 15 | Escolha o gabarito e crie; clique em **Publicar** | A questão nasce como **rascunho** e passa a aparecer para os alunos depois de publicada |
| 16 | Responda essa questão como PROFESSOR (em `/questoes`) e troque o gabarito no painel; depois responda com um **aluno** e tente trocar de novo | O teste do professor não trava nada. Depois da resposta do aluno: "Esta questão já foi respondida por alunos: dá para corrigir os textos, mas não o tipo, as alternativas (letras) nem o gabarito..." Corrigir o texto funciona. "Apagar questão" também é recusado (despublique) |
| 17 | **Bancas, assuntos e provas**: crie uma banca, um assunto e uma prova; tente apagar a banca "Cesgranrio" | Criados. A Cesgranrio não pode ser apagada (tem provas e questões) |
| 18 | **Importar planilha** → "Baixar o modelo (CSV)"; abra no Excel/LibreOffice, troque o gabarito de uma linha para `F`, salve como CSV (no Excel, "CSV (separado por ponto e vírgula)" ou "CSV UTF-8" — os dois funcionam) e envie | "Linha N: O gabarito precisa ser uma das alternativas." e **nada** é importado (limite: 500 questões e 900 KB por arquivo) |
| 19 | Corrija a linha e envie de novo; envie o mesmo arquivo uma terceira vez | "2 questões importadas como rascunho" (confira e publique na lista). Na terceira vez: erro de código repetido (a coluna `codigo` evita importar duas vezes) |
| 20 | Com um aluno, abra `/admin/questoes` e `/simulados/<id do simulado da outra conta>` | "Página não encontrada" nos dois |
| 21 | Com a 2ª conta, comece um simulado e revogue a matrícula dela no painel (Usuários); recarregue o simulado | "Seu acesso aos simulados terminou": o simulado fica guardado e continua quando o acesso voltar |

> As 3 provas do seed são **fictícias** (questões originais "no estilo" de cada banca), só para testar. O mapa
> "o que mais cai" fica bom de verdade quando o professor cadastrar provas reais já aplicadas (com a banca e o
> ano) e as questões delas: **só questões de prova publicadas** entram na conta.

---

## 7. Comandos do dia a dia

| Comando | Para que serve |
|---|---|
| `npm run dev` | Sobe o site em modo desenvolvimento (recarrega sozinho ao salvar arquivos) |
| `npm run build` | Gera a versão de produção (a Vercel roda isto a cada deploy) |
| `npm run lint` | Procura problemas comuns no código |
| `npm run typecheck` | Checa os tipos do TypeScript (como o `mypy`) |
| `npm test` | Testes unitários (rápidos, sem banco) |
| `npm run test:integration` | Testes com banco de verdade (ver seção 8) |
| `npm run db:migrate -- --name descricao` | Depois de **alterar** `prisma/schema.prisma`: cria e aplica uma nova migração |
| `npm run db:deploy` | Aplica migrações já existentes (primeira vez, produção) |
| `npm run db:studio` | Abre uma interface visual para ver/editar os dados do banco |
| `npm run db:seed` | Grava o curso e as questões de exemplo (só desenvolvimento; pode rodar várias vezes) |
| `npm run user:set-role -- email PERFIL` | Muda o perfil de um usuário (STUDENT, TEACHER, ADMIN). No dia a dia, use o painel (/admin/usuarios); o script serve para criar o primeiro ADMIN |
| `npm run enroll -- email curso [dias \| --revogar]` | Matrícula MANUAL num curso (sem data de fim ou por N dias), renova, ou revoga — o mesmo que o painel faz. Compras e assinaturas não mudam (acesso pago sai pelo reembolso) |

---

## 8. Testes automáticos

- **Unitários** (`npm test`): regras puras — perfis, limite de sessões, proteção de redirecionamento,
  validação de formulários, variáveis de ambiente, e-mails, **acesso às aulas** (matrícula),
  progresso, "continuar de onde parou", link, mensagens e regras de progresso do player do Panda,
  token da marca d'água, links assinados dos PDFs, as travas de perfil e as **vendas**: dinheiro em
  centavos, parcelas, CPF, datas de cobrança (fuso de Brasília), situação do pedido, prazo de reembolso,
  recálculo do acesso pago, tradução dos dados do Asaas e o provedor do Asaas com um `fetch` falso; e o
  **banco de questões**: letras e gabarito, cota grátis do dia, sorteio e nota do simulado, desempenho por
  assunto, mapa "o que mais cai", leitura de planilha CSV e importação.
- **Integração** (`npm run test:integration`): cadastro, login, limite de sessões, seed do catálogo,
  acesso às aulas, progresso, painel de cursos (criar, reordenar, apagar com proteção), envio e
  download de PDFs, matrículas e perfis, e as vendas (compra, avisos repetidos/atrasados, reembolso,
  contestação, assinatura, concorrência e a rota do webhook) e o banco de questões (responder, cota grátis com
  respostas simultâneas, simulados, mapa, painel com a proteção do histórico, importação e o seed), gravando
  num PostgreSQL de verdade.
  Os pagamentos nos testes são sempre SIMULADOS (a chave do Asaas é ignorada). **Os testes apagam os dados do banco que usam**, por isso exigem um banco
  SEPARADO na variável `TEST_DATABASE_URL`:
  1. Na Neon, crie uma branch chamada `test` (Branches → New branch).
  2. Copie a string de conexão **direta** dessa branch.
  3. Adicione ao `.env.local`: `TEST_DATABASE_URL="postgresql://..."`
  4. Rode `npm run test:integration`. (Os testes se recusam a rodar se esse banco for o mesmo da `DATABASE_URL`.)
- **CI:** a cada push/PR, o GitHub Actions roda lint, tipos, os dois tipos de teste e o build
  (`.github/workflows/ci.yml`), com um PostgreSQL temporário.

---

## 9. Onde fica cada coisa

```
prisma/
  schema.prisma          Tabelas do banco (como os models.py do Django/SQLAlchemy)
  migrations/            Histórico de alterações do banco (SQL gerado pelo Prisma)
  seed.ts, seed-catalog.ts, seed-questions.ts  Curso e questões de EXEMPLO para desenvolvimento (npm run db:seed)
scripts/                 set-role.ts (perfil) e enroll.ts (matrícula)
src/
  app/                   Páginas e rotas (cada pasta = um endereço do site)
    (auth)/              /entrar, /cadastro, /esqueci-senha, /redefinir-senha
    area-do-aluno/       Área do aluno: meus cursos, dispositivos, compras/, pagamentos/[id] e desempenho/ (exige login)
    questoes/, simulados/  Resolver questões e simulados (exige login); o-que-mais-cai/ = mapa público por banca
    comprar/, assinar/   Checkout de produto e de assinatura (exige login); planos/ = vitrine da assinatura
    dev/pagamentos/      SIMULADOR de pagamento (só desenvolvimento, sem conta no Asaas)
    cursos/              /cursos (catálogo), /cursos/[curso], /cursos/[curso]/aulas/[aula] (player)
                         e .../materiais/[id] (download do PDF, confere o acesso a cada clique)
    admin/               Painel: visão geral, cursos/[id]/aulas/[id] e questoes/ (TEACHER+), usuarios/[id] e vendas/ (ADMIN)
    api/auth/[...all]/   API de autenticação (/api/auth/*)
    api/dev-storage/     Envio/download de PDFs SEM o R2 (só desenvolvimento)
    api/webhooks/asaas/  Onde o Asaas avisa os pagamentos (confere o token)
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
    payments/            Vendas: checkout, avisos do provedor, recálculo do acesso pago (access-sync),
                         reembolsos, notas fiscais; provider/ = Asaas e o simulado; admin/ = painel de vendas
    questions/           Banco de questões: acesso e cota grátis (access.ts), respostas, simulados, desempenho,
                         mapa de incidência, planilha CSV; admin/ = cadastro e importação pelo painel
    storage/             Armazenamento de arquivos: Cloudflare R2 ou pasta local (desenvolvimento)
    email/               Envio de e-mails e modelos de texto
  proxy.ts               Barreira rápida das áreas protegidas
  generated/prisma/      Cliente do banco GERADO pelo Prisma (não editar; fora do Git)
tests/integration/       Testes que usam o banco de verdade
```

---

## 10. Publicando na Vercel (quando for a hora)

1. Na Vercel: **Add New → Project** e importe este repositório do GitHub.
2. Em **Settings → Environment Variables**, cadastre as mesmas variáveis do `.env.example`,
   com valores de produção (`BETTER_AUTH_URL` = endereço do site, `BETTER_AUTH_SECRET` novo,
   `RESEND_API_KEY` obrigatória, `PANDA_DRM_*` obrigatórias para os vídeos tocarem, `R2_*` para os PDFs e
   `ASAAS_*` para vender — sem a chave, as vendas ficam desligadas em produção).
3. Antes do primeiro deploy (e sempre que houver migração nova), aplique as migrações no banco
   de produção: `DIRECT_URL="<url direta de produção>" npm run db:deploy`.
4. Se usar Google: cadastre `https://SEU-DOMINIO/api/auth/callback/google` como URI de
   redirecionamento no Google Cloud Console.
