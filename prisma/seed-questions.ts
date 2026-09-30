/**
 * seed-questions.ts — Banco de questões de EXEMPLO (bancas, assuntos, provas e 30 questões).
 *
 * Quem chama: `prisma/seed.ts` (comando `npm run db:seed`). Só desenvolvimento.
 * O que devolve: `seedQuestionBank(prisma)` → quantos itens criou.
 *
 * As questões são ORIGINAIS (escritas para o exemplo), e as "provas" são fictícias ("Prova de
 * exemplo — ..."): servem para testar a resolução, os simulados e o mapa "o que mais cai" sem
 * conteúdo real. O conteúdo real entra pelo painel (/admin/questoes) ou pela importação.
 *
 * Pode rodar quantas vezes quiser: bancas/assuntos/provas são atualizados pelo identificador
 * (slug); questões são criadas só se o código ainda não existe — uma questão que já existe não
 * é alterada (ela pode ter respostas de alunos, e mudar o gabarito bagunçaria o histórico).
 */
import type { PrismaClient } from "../src/generated/prisma/client";

const BOARDS = [
  { slug: "cesgranrio", name: "Cesgranrio" },
  { slug: "cebraspe", name: "Cebraspe" },
  { slug: "fgv", name: "FGV" },
  { slug: "fcc", name: "FCC" },
];

const SUBJECTS = [
  { slug: "seguranca-da-informacao", name: "Segurança da Informação", position: 1 },
  { slug: "redes-e-internet", name: "Redes e Internet", position: 2 },
  { slug: "office-e-libreoffice", name: "Office e LibreOffice", position: 3 },
  { slug: "sistemas-operacionais", name: "Sistemas Operacionais", position: 4 },
  { slug: "computacao-em-nuvem", name: "Computação em Nuvem", position: 5 },
  { slug: "hardware", name: "Hardware e conceitos básicos", position: 6 },
];

const EXAMS = [
  { slug: "exemplo-banco-escriturario-2024", name: "Prova de exemplo — Banco (Escriturário)", year: 2024, board: "cesgranrio" },
  { slug: "exemplo-tribunal-tecnico-2023", name: "Prova de exemplo — Tribunal (Técnico)", year: 2023, board: "cebraspe" },
  { slug: "exemplo-agencia-analista-2024", name: "Prova de exemplo — Agência (Analista)", year: 2024, board: "fgv" },
];

type SeedQuestion = {
  code: string;
  subject: string;
  exam?: string;
  board?: string; // só para inéditas "no estilo de"
  statement: string;
  options?: string[]; // múltipla escolha (A, B, C...); ausente = Certo/Errado
  answer: string;
  explanation: string;
};

export const SEED_QUESTIONS: SeedQuestion[] = [
  // --- Prova de exemplo — Banco (Cesgranrio) ---
  {
    code: "EXEMPLO-01",
    subject: "seguranca-da-informacao",
    exam: "exemplo-banco-escriturario-2024",
    statement:
      "Um funcionário recebeu um e-mail que imita a página do banco e pede que ele confirme a senha clicando em um link. Esse tipo de golpe é chamado de:",
    options: ["spam", "phishing", "backup", "firewall", "cookie"],
    answer: "B",
    explanation:
      "Phishing (de \"pescaria\") imita uma instituição conhecida para \"pescar\" dados como senhas. Spam é mensagem em massa não solicitada; backup é cópia de segurança; firewall filtra o tráfego da rede; cookie é um arquivo pequeno guardado pelo navegador.",
  },
  {
    code: "EXEMPLO-02",
    subject: "seguranca-da-informacao",
    exam: "exemplo-banco-escriturario-2024",
    statement: "Qual tipo de programa malicioso criptografa os arquivos do usuário e exige um pagamento para liberá-los?",
    options: ["Ransomware", "Adware", "Spyware", "Worm", "Keylogger"],
    answer: "A",
    explanation:
      "Ransomware \"sequestra\" os dados (ransom = resgate). Adware mostra propagandas; spyware espiona; worm se espalha sozinho pela rede; keylogger grava o que é digitado.",
  },
  {
    code: "EXEMPLO-03",
    subject: "seguranca-da-informacao",
    exam: "exemplo-banco-escriturario-2024",
    statement: "A autenticação em dois fatores (2FA) aumenta a segurança de uma conta porque:",
    options: [
      "dispensa o uso de senha",
      "exige algo que o usuário sabe (a senha) e algo que ele tem, como um código no celular",
      "criptografa o disco rígido do computador",
      "impede a instalação de programas",
      "bloqueia todos os e-mails de fora da empresa",
    ],
    answer: "B",
    explanation:
      "Com dois fatores, quem descobre só a senha ainda não entra: falta o segundo fator (código no celular, token, biometria). As outras alternativas descrevem recursos que nada têm a ver com 2FA.",
  },
  {
    code: "EXEMPLO-04",
    subject: "seguranca-da-informacao",
    exam: "exemplo-banco-escriturario-2024",
    statement: "O tipo de backup que copia apenas os arquivos alterados desde o último backup de QUALQUER tipo é o backup:",
    options: ["completo", "diferencial", "incremental", "espelhado", "sintético"],
    answer: "C",
    explanation:
      "Incremental: desde o último backup de qualquer tipo. Diferencial: desde o último backup COMPLETO. Essa diferença é uma das pegadinhas mais cobradas.",
  },
  {
    code: "EXEMPLO-05",
    subject: "redes-e-internet",
    exam: "exemplo-banco-escriturario-2024",
    statement: "O protocolo usado para acessar páginas da web de forma segura, com criptografia, é o:",
    options: ["HTTP", "FTP", "HTTPS", "SMTP", "POP3"],
    answer: "C",
    explanation: "HTTPS é o HTTP com uma camada de segurança (TLS), indicada pelo cadeado no navegador. FTP transfere arquivos; SMTP envia e-mails; POP3 recebe e-mails.",
  },
  {
    code: "EXEMPLO-06",
    subject: "redes-e-internet",
    exam: "exemplo-banco-escriturario-2024",
    statement: "O serviço que traduz nomes como www.exemplo.com.br em endereços IP é o:",
    options: ["DHCP", "DNS", "VPN", "SMTP", "URL"],
    answer: "B",
    explanation: "O DNS funciona como uma \"agenda telefônica\" da internet. DHCP distribui endereços IP automaticamente; URL é o endereço completo digitado no navegador.",
  },
  {
    code: "EXEMPLO-07",
    subject: "redes-e-internet",
    exam: "exemplo-banco-escriturario-2024",
    statement: "Uma VPN (rede privada virtual) é usada principalmente para:",
    options: [
      "aumentar a velocidade da internet",
      "criar uma conexão protegida (criptografada) com uma rede, passando pela internet",
      "substituir o antivírus",
      "armazenar arquivos na nuvem",
      "enviar e-mails em massa",
    ],
    answer: "B",
    explanation: "A VPN cria um \"túnel\" criptografado: é assim que um funcionário acessa a rede interna do órgão estando em casa.",
  },
  {
    code: "EXEMPLO-08",
    subject: "office-e-libreoffice",
    exam: "exemplo-banco-escriturario-2024",
    statement: "No Microsoft Excel, a fórmula =SOMA(A1:A3) calcula:",
    options: [
      "a média de A1 a A3",
      "a soma dos valores de A1, A2 e A3",
      "a soma de A1 e A3 apenas",
      "o maior valor entre A1 e A3",
      "quantas células estão preenchidas",
    ],
    answer: "B",
    explanation: "Os dois-pontos indicam um intervalo (de A1 ATÉ A3). Com ponto e vírgula, =SOMA(A1;A3), seriam só as duas células.",
  },
  {
    code: "EXEMPLO-09",
    subject: "office-e-libreoffice",
    exam: "exemplo-banco-escriturario-2024",
    statement: "No Microsoft Word, o atalho Ctrl+Z serve para:",
    options: ["salvar", "desfazer a última ação", "copiar", "colar", "imprimir"],
    answer: "B",
    explanation: "Ctrl+Z desfaz; Ctrl+S salva (no Word em português, Ctrl+B); Ctrl+C copia; Ctrl+V cola; Ctrl+P imprime.",
  },
  {
    code: "EXEMPLO-10",
    subject: "sistemas-operacionais",
    exam: "exemplo-banco-escriturario-2024",
    statement: "No Windows, a combinação de teclas Windows + L é usada para:",
    options: [
      "abrir o Explorador de Arquivos",
      "bloquear o computador",
      "mostrar a área de trabalho",
      "abrir o Gerenciador de Tarefas",
      "desligar o computador",
    ],
    answer: "B",
    explanation: "Windows + L (de Lock) bloqueia a sessão. Windows + E abre o Explorador; Windows + D mostra a área de trabalho; Ctrl + Shift + Esc abre o Gerenciador de Tarefas.",
  },

  // --- Prova de exemplo — Tribunal (Cebraspe, Certo/Errado) ---
  {
    code: "EXEMPLO-11",
    subject: "seguranca-da-informacao",
    exam: "exemplo-tribunal-tecnico-2023",
    statement:
      "Um worm é um programa malicioso capaz de se propagar automaticamente pela rede, explorando falhas, sem precisar ser anexado a outro arquivo.",
    answer: "C",
    explanation: "Certo. É justamente o que diferencia o worm do vírus: o vírus precisa de um arquivo hospedeiro e de uma ação do usuário para se espalhar.",
  },
  {
    code: "EXEMPLO-12",
    subject: "seguranca-da-informacao",
    exam: "exemplo-tribunal-tecnico-2023",
    statement: "O firewall, sozinho, é suficiente para impedir que o usuário se infecte ao abrir um anexo malicioso recebido por e-mail.",
    answer: "E",
    explanation:
      "Errado. O firewall controla o tráfego da rede; abrir um anexo é uma ação do próprio usuário. A proteção vem do antivírus e, principalmente, do cuidado ao abrir anexos.",
  },
  {
    code: "EXEMPLO-13",
    subject: "seguranca-da-informacao",
    exam: "exemplo-tribunal-tecnico-2023",
    statement: "A assinatura digital garante a autenticidade e a integridade de um documento eletrônico.",
    answer: "C",
    explanation:
      "Certo. A assinatura digital garante autenticidade (quem assinou), integridade (não foi alterado) e não repúdio. Atenção: ela NÃO garante sigilo (confidencialidade).",
  },
  {
    code: "EXEMPLO-14",
    subject: "redes-e-internet",
    exam: "exemplo-tribunal-tecnico-2023",
    statement:
      "As páginas da intranet de um órgão podem ser acessadas com o mesmo navegador usado na internet, pois a intranet usa os mesmos protocolos, como o HTTP.",
    answer: "C",
    explanation: "Certo. A intranet é uma rede interna que usa as mesmas tecnologias da internet; a diferença é o acesso restrito às pessoas da organização.",
  },
  {
    code: "EXEMPLO-15",
    subject: "redes-e-internet",
    exam: "exemplo-tribunal-tecnico-2023",
    statement: "O endereço IP 192.168.0.10 é público, podendo ser acessado diretamente de qualquer computador da internet.",
    answer: "E",
    explanation: "Errado. Endereços 192.168.x.x são PRIVADOS, usados dentro de redes locais (como a da sua casa); não são alcançáveis diretamente pela internet.",
  },
  {
    code: "EXEMPLO-16",
    subject: "computacao-em-nuvem",
    exam: "exemplo-tribunal-tecnico-2023",
    statement:
      "No modelo SaaS (software como serviço), o usuário usa um aplicativo pela internet sem precisar instalá-lo nem administrar os servidores onde ele roda.",
    answer: "C",
    explanation: "Certo. Exemplos: Gmail, Microsoft 365 no navegador. No IaaS e no PaaS, o cliente cuida de mais partes da infraestrutura.",
  },
  {
    code: "EXEMPLO-17",
    subject: "computacao-em-nuvem",
    exam: "exemplo-tribunal-tecnico-2023",
    statement: "Arquivos guardados em serviços de nuvem, como o Google Drive, só podem ser acessados no computador de onde foram enviados.",
    answer: "E",
    explanation: "Errado. A vantagem da nuvem é justamente acessar os arquivos de qualquer dispositivo com internet, usando a sua conta.",
  },
  {
    code: "EXEMPLO-18",
    subject: "sistemas-operacionais",
    exam: "exemplo-tribunal-tecnico-2023",
    statement: "No Linux, o comando ls lista o conteúdo de um diretório (pasta).",
    answer: "C",
    explanation: "Certo. Outros comandos que caem: cd (entrar em pasta), pwd (mostrar a pasta atual), cp (copiar), mv (mover/renomear), rm (apagar).",
  },

  // --- Prova de exemplo — Agência (FGV) ---
  {
    code: "EXEMPLO-19",
    subject: "office-e-libreoffice",
    exam: "exemplo-agencia-analista-2024",
    statement: "No LibreOffice Calc, para que a referência à célula B2 não mude quando a fórmula for copiada para outras células, usa-se:",
    options: ["B2", "#B#2", "$B$2", "&B&2", "@B2"],
    answer: "C",
    explanation: "O cifrão \"trava\" a coluna ($B) e a linha ($2): é a referência absoluta. Vale igual no Excel.",
  },
  {
    code: "EXEMPLO-20",
    subject: "office-e-libreoffice",
    exam: "exemplo-agencia-analista-2024",
    statement: "Em um editor de textos, o recurso que troca todas as ocorrências de uma palavra por outra de uma só vez é o:",
    options: ["Localizar e substituir", "Autocorreção", "Controlar alterações", "Mala direta", "Hifenização"],
    answer: "A",
    explanation: "\"Localizar e substituir\" (Ctrl+U no Word em português; Ctrl+H no LibreOffice Writer). Mala direta gera cartas personalizadas a partir de uma lista.",
  },
  {
    code: "EXEMPLO-21",
    subject: "seguranca-da-informacao",
    exam: "exemplo-agencia-analista-2024",
    statement: "Qual das práticas abaixo ajuda a criar senhas mais fortes?",
    options: [
      "usar a data de nascimento",
      "repetir a mesma senha em todos os sites",
      "combinar letras maiúsculas e minúsculas, números e símbolos, com boa extensão",
      "usar o próprio nome",
      "anotar a senha em um papel colado no monitor",
    ],
    answer: "C",
    explanation: "Senha forte é longa e variada. Dados pessoais são fáceis de adivinhar, e repetir a senha faz um vazamento em um site abrir todos os outros.",
  },
  {
    code: "EXEMPLO-22",
    subject: "seguranca-da-informacao",
    exam: "exemplo-agencia-analista-2024",
    statement: "O princípio da segurança da informação que garante que a informação só seja acessada por quem tem autorização é a:",
    options: ["disponibilidade", "integridade", "confidencialidade", "autenticidade", "irretratabilidade"],
    answer: "C",
    explanation: "Confidencialidade = sigilo. Integridade = não foi alterada; disponibilidade = está acessível quando precisa; autenticidade = confirma quem é o autor.",
  },
  {
    code: "EXEMPLO-23",
    subject: "hardware",
    exam: "exemplo-agencia-analista-2024",
    statement: "A memória do computador que é volátil, isto é, perde o conteúdo quando o equipamento é desligado, é a:",
    options: ["ROM", "RAM", "HD", "SSD", "pendrive"],
    answer: "B",
    explanation: "A RAM guarda o que está em uso agora e se apaga ao desligar. ROM, HD, SSD e pendrive mantêm os dados sem energia.",
  },
  {
    code: "EXEMPLO-24",
    subject: "redes-e-internet",
    exam: "exemplo-agencia-analista-2024",
    statement: "O protocolo usado para ENVIAR mensagens de e-mail é o:",
    options: ["POP3", "IMAP", "SMTP", "HTTP", "FTP"],
    answer: "C",
    explanation: "SMTP envia. POP3 e IMAP servem para RECEBER/ler (o IMAP mantém as mensagens no servidor, sincronizadas entre dispositivos).",
  },

  // --- Inéditas ---
  {
    code: "EXEMPLO-25",
    subject: "hardware",
    statement: "Qual dos dispositivos abaixo é apenas de ENTRADA de dados?",
    options: ["Monitor", "Impressora", "Teclado", "Caixa de som", "Projetor"],
    answer: "C",
    explanation: "O teclado envia dados para o computador (entrada). Monitor, impressora, caixa de som e projetor mostram resultados (saída).",
  },
  {
    code: "EXEMPLO-26",
    subject: "hardware",
    board: "cebraspe",
    statement: "O SSD é um tipo de armazenamento sem partes móveis e, em geral, mais rápido que o HD tradicional.",
    answer: "C",
    explanation: "Certo. O SSD usa memória flash (como um pendrive), enquanto o HD tem discos que giram — por isso o SSD é mais rápido e resistente a impactos.",
  },
  {
    code: "EXEMPLO-27",
    subject: "sistemas-operacionais",
    statement: "No Windows, a Lixeira serve para:",
    options: [
      "guardar temporariamente os arquivos excluídos, permitindo restaurá-los",
      "apagar vírus automaticamente",
      "liberar memória RAM",
      "compactar arquivos",
      "fazer backup automático",
    ],
    answer: "A",
    explanation: "Arquivos apagados vão para a Lixeira e podem ser restaurados. Com Shift + Delete, o arquivo é excluído sem passar por ela.",
  },
  {
    code: "EXEMPLO-28",
    subject: "computacao-em-nuvem",
    statement: "Qual destes é um exemplo de armazenamento em nuvem?",
    options: ["Pendrive", "HD externo", "OneDrive", "DVD", "Memória RAM"],
    answer: "C",
    explanation: "OneDrive (assim como Google Drive e Dropbox) guarda os arquivos em servidores na internet. Os demais são armazenamentos físicos, locais.",
  },
  {
    code: "EXEMPLO-29",
    subject: "redes-e-internet",
    board: "cebraspe",
    statement: "Navegar em modo anônimo (navegação privada) impede que o provedor de internet saiba quais sites foram visitados.",
    answer: "E",
    explanation: "Errado. O modo anônimo só evita que o NAVEGADOR guarde histórico, cookies e dados de formulário naquele computador. O provedor e os sites continuam vendo o acesso.",
  },
  {
    code: "EXEMPLO-30",
    subject: "office-e-libreoffice",
    statement: "No Excel, a função que retorna a média aritmética de um intervalo de células é:",
    options: ["SOMA", "MÉDIA", "MÁXIMO", "CONT.VALORES", "SE"],
    answer: "B",
    explanation: "=MÉDIA(A1:A10) soma os valores e divide pela quantidade. SOMA soma; MÁXIMO dá o maior; CONT.VALORES conta células preenchidas; SE testa uma condição.",
  },
];

const LABELS = ["A", "B", "C", "D", "E"];

/**
 * Grava o banco de questões de exemplo.
 * Passos: (1) bancas, assuntos e provas por slug (cria ou atualiza); (2) cada questão, só se o
 * código ainda não existir — já publicada.
 */
export async function seedQuestionBank(prisma: PrismaClient): Promise<{ boards: number; subjects: number; exams: number; created: number }> {
  const boardIds = new Map<string, string>();
  for (const board of BOARDS) {
    const row = await prisma.board.upsert({ where: { slug: board.slug }, create: board, update: { name: board.name } });
    boardIds.set(board.slug, row.id);
  }
  const subjectIds = new Map<string, string>();
  for (const subject of SUBJECTS) {
    const row = await prisma.subject.upsert({
      where: { slug: subject.slug },
      create: subject,
      update: { name: subject.name, position: subject.position },
    });
    subjectIds.set(subject.slug, row.id);
  }
  const exams = new Map<string, { id: string; boardId: string }>();
  for (const exam of EXAMS) {
    const boardId = boardIds.get(exam.board) as string;
    const row = await prisma.exam.upsert({
      where: { slug: exam.slug },
      create: { slug: exam.slug, name: exam.name, year: exam.year, boardId },
      update: { name: exam.name, year: exam.year, boardId },
    });
    exams.set(exam.slug, { id: row.id, boardId });
  }

  let created = 0;
  for (const question of SEED_QUESTIONS) {
    const exists = await prisma.question.findUnique({ where: { code: question.code }, select: { id: true } });
    if (exists) continue;
    const exam = question.exam ? exams.get(question.exam) : undefined;
    await prisma.question.create({
      data: {
        code: question.code,
        type: question.options ? "MULTIPLE_CHOICE" : "TRUE_FALSE",
        statement: question.statement,
        correctAnswer: question.answer,
        explanation: question.explanation,
        subjectId: subjectIds.get(question.subject) as string,
        examId: exam?.id ?? null,
        boardId: exam?.boardId ?? (question.board ? (boardIds.get(question.board) ?? null) : null),
        isPublished: true,
        options: { create: (question.options ?? []).map((text, index) => ({ label: LABELS[index], text })) },
      },
    });
    created += 1;
  }
  return { boards: BOARDS.length, subjects: SUBJECTS.length, exams: EXAMS.length, created };
}
