/**
 * page.tsx — Política de privacidade: /privacidade
 *
 * Quem chama: o Next.js (rodapé, cadastro, tela de aceite, aviso de cookies).
 * Explica, em linguagem simples, o que a plataforma faz com os dados pessoais (LGPD): quais dados,
 * para quê (e com qual base legal), com quem compartilha, por quanto tempo guarda, cookies e os
 * direitos do titular — e onde exercê-los no site (Minha conta e privacidade).
 * Mudou o texto? Troque também `LEGAL_VERSION` (`src/modules/legal/version.ts`).
 *
 * IMPORTANTE: este é um MODELO escrito a partir do que o site realmente faz. Antes do lançamento,
 * peça a um advogado para revisar (PROJECT.md, pendências da Fase 7).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument, Section } from "@/modules/legal/components/legal-document";
import { getCompanyInfo } from "@/modules/legal/company.server";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como a plataforma Concurso TI trata os seus dados pessoais, de acordo com a LGPD.",
  alternates: { canonical: "/privacidade" },
};

export default function PrivacyPage() {
  const company = getCompanyInfo();

  return (
    <LegalDocument
      title="Política de privacidade"
      intro={
        <p>
          Esta política explica como <strong>{company.name}</strong> (documento {company.document}), a controladora dos dados
          da plataforma Concurso TI, trata os seus dados pessoais, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei
          13.709/2018). Pedidos e dúvidas sobre os seus dados: <a href={`mailto:${company.contactEmail}`} className="underline">{company.contactEmail}</a>{" "}
          (canal do encarregado de dados).
        </p>
      }
    >
      <Section title="1. Quais dados coletamos">
        <ul>
          <li>
            <strong>Cadastro:</strong> nome, e-mail e senha (guardada cifrada — nem nós conseguimos ler). Se você entrar com o
            Google, recebemos do Google o seu nome, e-mail e foto.
          </li>
          <li>
            <strong>Uso da plataforma:</strong> aulas assistidas e em que ponto parou, respostas das questões, simulados e
            desempenho.
          </li>
          <li>
            <strong>Acesso e segurança:</strong> endereço IP, navegador e aparelho de cada login (para o limite de 2
            dispositivos, para a sua segurança e porque a lei exige o registro de acesso), e o registro de quando você
            aceitou estes textos.
          </li>
          <li>
            <strong>Compras:</strong> CPF e celular (opcional) de quem paga, os produtos comprados, valores, forma de pagamento e
            situação dos pagamentos. Os dados do cartão são digitados direto no Asaas e não passam por nós.
          </li>
          <li>
            <strong>Afiliados:</strong> a chave Pix (ou outra forma de receber) informada pela pessoa afiliada.
          </li>
        </ul>
      </Section>

      <Section title="2. Para que usamos e com qual base legal">
        <ul>
          <li>
            <strong>Prestar o serviço que você contratou</strong> (conta, aulas, questões, progresso, compras, suporte) —
            execução de contrato (LGPD, art. 7º, V).
          </li>
          <li>
            <strong>Cumprir a lei</strong> (notas fiscais, registros de compras e o registro de acesso exigido pelo Marco Civil
            da Internet) — obrigação legal (art. 7º, II).
          </li>
          <li>
            <strong>Proteger a plataforma e você</strong> (limite de dispositivos, prevenção a fraudes e a pirataria, com marca
            d&apos;água com dados da conta nos vídeos) — legítimo interesse (art. 7º, IX).
          </li>
          <li>
            <strong>Entender o uso do site para melhorá-lo</strong> (cookies de análise) — só com o seu consentimento (art. 7º, I),
            que pode ser retirado a qualquer momento.
          </li>
        </ul>
        <p>Não vendemos os seus dados e não os usamos para propaganda de terceiros.</p>
      </Section>

      <Section title="3. Com quem compartilhamos">
        <p>Só com os fornecedores necessários para o site funcionar (operadores), cada um para a sua função:</p>
        <ul>
          <li>Asaas — pagamentos (Pix, boleto, cartão) e emissão de notas fiscais: nome, e-mail, CPF e dados da compra.</li>
          <li>Panda Video — reprodução das aulas: nome, e-mail e identificação da conta na marca d&apos;água dos vídeos.</li>
          <li>Vercel (hospedagem), Neon (banco de dados) e Cloudflare (arquivos PDF das aulas).</li>
          <li>Resend — envio dos e-mails do site (confirmação, link de acesso, recibos).</li>
          <li>Google — só se você escolher entrar com a conta Google.</li>
          <li>Sentry — avisos de erro do site, sem nome, e-mail ou CPF.</li>
          <li>PostHog — estatísticas de uso, só se você aceitar os cookies de análise.</li>
        </ul>
        <p>
          Alguns desses fornecedores guardam dados em servidores fora do Brasil (por exemplo, nos Estados Unidos), com
          garantias contratuais de proteção, como permite a LGPD (art. 33). Também compartilhamos dados quando uma lei ou
          ordem judicial exigir.
        </p>
      </Section>

      <Section title="4. Por quanto tempo guardamos">
        <ul>
          <li>Dados da conta e de estudo: enquanto a conta existir.</li>
          <li>
            Compras, pagamentos, notas fiscais e o CPF de quem comprou: por 5 anos após a compra, mesmo se a conta for excluída
            (obrigação fiscal) — sem o seu nome e e-mail.
          </li>
          <li>
            Registro de acesso (data, hora e IP de cada login): 6 meses, como exige o Marco Civil da Internet (Lei 12.965/2014,
            art. 15), mesmo se a conta for excluída. Só é entregue a terceiros com ordem judicial.
          </li>
          <li>Registro dos aceites destes textos: guardado como prova do consentimento.</li>
          <li>Cópias de segurança do banco de dados são apagadas automaticamente em poucos dias.</li>
        </ul>
      </Section>

      <Section title="5. Cookies">
        <ul>
          <li>
            <strong>Essenciais</strong> (sempre ligados): o de login, que mantém você conectado, e o de indicação de parceiro
            (afiliado), que dura 30 dias.
          </li>
          <li>
            <strong>De análise</strong> (só com o seu aceite): PostHog, para contar visitas e entender o uso das páginas. Você
            escolhe no aviso de cookies e pode mudar a qualquer momento em &quot;Preferências de cookies&quot;, no rodapé.
          </li>
        </ul>
      </Section>

      <Section title="6. Seus direitos (LGPD, art. 18)">
        <p>Você pode, a qualquer momento:</p>
        <ul>
          <li>
            ver e baixar os seus dados, corrigir o nome e excluir a conta em{" "}
            <Link href="/area-do-aluno/conta" className="underline">
              Minha conta e privacidade
            </Link>
            ;
          </li>
          <li>retirar o consentimento dos cookies de análise, em &quot;Preferências de cookies&quot;;</li>
          <li>
            pedir informações sobre o compartilhamento, a correção de outros dados ou qualquer outro direito pelo e-mail{" "}
            <a href={`mailto:${company.contactEmail}`} className="underline">
              {company.contactEmail}
            </a>{" "}
            — respondemos em até 15 dias;
          </li>
          <li>reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
        </ul>
        <p>
          Ao excluir a conta, apagamos logins, progresso, respostas, simulados, nome e e-mail. Ficam só os registros de compra
          exigidos pela lei (item 4), sem o seu nome.
        </p>
      </Section>

      <Section title="7. Segurança">
        <p>
          Senhas cifradas, conexão sempre segura (HTTPS), links temporários para vídeos e PDFs, acesso aos dados restrito à equipe
          que precisa deles e avisos automáticos de erro. Se acontecer um incidente que possa trazer risco a você, avisaremos você
          e a ANPD, como manda a lei.
        </p>
      </Section>

      <Section title="8. Mudanças nesta política">
        <p>
          Quando esta política mudar, a data da versão no topo da página muda e você verá o texto novo para aceitar antes de
          continuar usando a área do aluno.
          {company.address ? ` Endereço da controladora: ${company.address}.` : ""}
        </p>
      </Section>
    </LegalDocument>
  );
}
