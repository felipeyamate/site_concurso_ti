/**
 * page.tsx — Termos de uso: /termos
 *
 * Quem chama: o Next.js (rodapé, cadastro, checkout, tela de aceite).
 * O texto descreve as regras que o site APLICA (acesso, dispositivos, compras, reembolso, cupons,
 * questões grátis). Mudou alguma regra ou o texto? Troque também `LEGAL_VERSION`
 * (`src/modules/legal/version.ts`): todos precisarão aceitar a versão nova.
 * Os dados da empresa vêm das variáveis LEGAL_* (`legal/company.server.ts`).
 *
 * IMPORTANTE: este é um MODELO escrito a partir das regras do site. Antes do lançamento, peça a
 * um advogado para revisar (PROJECT.md, pendências da Fase 7).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument, Section } from "@/modules/legal/components/legal-document";
import { getCompanyInfo } from "@/modules/legal/company.server";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "As regras de uso da plataforma: conta, acesso aos cursos, compras, assinaturas, reembolso e conteúdo.",
  alternates: { canonical: "/termos" },
};

export default function TermsPage() {
  const company = getCompanyInfo();

  return (
    <LegalDocument
      title="Termos de uso"
      intro={
        <p>
          Estes termos são o acordo entre você e <strong>{company.name}</strong> (documento {company.document}), responsável pela
          plataforma Concurso TI. Ao criar a conta, você declara que leu e aceita estes termos e a{" "}
          <Link href="/privacidade" className="underline">
            Política de privacidade
          </Link>
          . Dúvidas: <a href={`mailto:${company.contactEmail}`} className="underline">{company.contactEmail}</a>.
        </p>
      }
    >
      <Section title="1. O que é a plataforma">
        <p>
          Cursos online, questões comentadas, simulados e materiais de estudo de Informática e TI para concursos públicos. O
          conteúdo é educacional: ajuda na preparação, mas não garante aprovação em nenhum concurso.
        </p>
      </Section>

      <Section title="2. Sua conta">
        <ul>
          <li>A conta é pessoal: você é responsável pelo que for feito com ela e por manter a senha em segredo.</li>
          <li>
            A conta pode ficar conectada em até 2 dispositivos ao mesmo tempo; ao entrar num terceiro, o acesso mais antigo é
            encerrado.
          </li>
          <li>Os dados informados precisam ser verdadeiros (nome, e-mail e, nas compras, o CPF de quem paga).</li>
          <li>A plataforma é destinada a maiores de 18 anos. Menores só podem usar com autorização e acompanhamento dos responsáveis.</li>
        </ul>
      </Section>

      <Section title="3. Uso do conteúdo">
        <ul>
          <li>
            Vídeos, textos, PDFs, questões comentadas e simulados são protegidos por direitos autorais e liberados só para o seu
            estudo pessoal.
          </li>
          <li>
            É proibido copiar, gravar a tela, baixar por meios não oferecidos pelo site, revender, compartilhar a conta ou
            distribuir o conteúdo. Os vídeos têm marca d&apos;água com dados da sua conta.
          </li>
          <li>O uso proibido pode levar à suspensão da conta, sem reembolso, além das medidas legais cabíveis.</li>
          <li>
            Questões de provas anteriores são reproduzidas para fins de estudo, com a indicação da banca e da prova; os
            comentários e as questões inéditas são nossos.
          </li>
        </ul>
      </Section>

      <Section title="4. Acesso gratuito">
        <p>
          Com a conta gratuita, você assiste às aulas marcadas como grátis e resolve até 10 questões por dia (contadas pelo dia
          de Brasília). Simulados e o banco completo de questões fazem parte do acesso pago.
        </p>
      </Section>

      <Section title="5. Compras, assinaturas e reembolso">
        <ul>
          <li>
            Os pagamentos são processados pelo Asaas (Pix, boleto ou cartão). Os dados do cartão são digitados na página do
            Asaas e não passam pelo nosso site.
          </li>
          <li>O acesso é liberado quando o pagamento é confirmado e vale pelo prazo informado na página de compra.</li>
          <li>
            Direito de arrependimento: você pode pedir o reembolso em até 7 dias depois do pagamento, em &quot;Minhas
            compras&quot;. O acesso daquela compra termina no momento do pedido. Pagamentos por boleto são devolvidos por
            transferência, combinada com a nossa equipe.
          </li>
          <li>
            Assinatura: renova a cada ciclo (mensal ou anual) até ser cancelada. Cancelando, o acesso continua até o fim do
            período já pago. O reembolso em 7 dias vale para o primeiro pagamento.
          </li>
          <li>Contestação do pagamento no cartão (chargeback) encerra o acesso da compra contestada.</li>
          <li>Quando houver, a nota fiscal de serviço é emitida em nome de quem pagou, com o CPF informado na compra.</li>
        </ul>
      </Section>

      <Section title="6. Cupons e indicações">
        <ul>
          <li>
            Cupons têm regras próprias (validade, quantidade e produtos/planos) mostradas na compra; não são cumulativos e não
            valem para compras já feitas. Na assinatura, o desconto vale para todas as renovações.
          </li>
          <li>
            Se você chegou por um link de um parceiro (afiliado), a indicação é registrada por até 30 dias e o parceiro recebe
            uma comissão sobre a venda. Isso não muda o preço que você paga.
          </li>
        </ul>
      </Section>

      <Section title="7. Disponibilidade e responsabilidades">
        <ul>
          <li>
            Trabalhamos para manter a plataforma no ar, mas podem ocorrer interrupções para manutenção ou por falhas de
            terceiros (internet, hospedagem, vídeo, pagamento).
          </li>
          <li>
            Editais, datas e regras de concursos são informados com base nas fontes oficiais; confira sempre o edital publicado
            pela banca.
          </li>
        </ul>
      </Section>

      <Section title="8. Encerramento da conta">
        <p>
          Você pode excluir a sua conta quando quiser, em{" "}
          <Link href="/area-do-aluno/conta" className="underline">
            Minha conta e privacidade
          </Link>{" "}
          (antes, cancele uma assinatura ativa). Os dados de compras e pagamentos são guardados pelo prazo da lei, como explica a
          Política de privacidade. Podemos suspender contas que descumprirem estes termos.
        </p>
      </Section>

      <Section title="9. Mudanças nestes termos">
        <p>
          Quando estes termos mudarem, a data da versão no topo da página muda e você precisará ler e aceitar a nova versão
          para continuar usando a área do aluno. Compras já feitas seguem as regras da época da compra.
        </p>
      </Section>

      <Section title="10. Lei e foro">
        <p>
          Estes termos seguem as leis brasileiras, incluindo o Código de Defesa do Consumidor. Fica eleito o foro do domicílio
          do consumidor para resolver qualquer questão.
          {company.address ? ` Endereço da empresa: ${company.address}.` : ""}
        </p>
      </Section>
    </LegalDocument>
  );
}
