/**
 * company.server.ts — Os dados da empresa que aparecem nos Termos de uso e na Política de privacidade.
 *
 * Quem chama: as páginas /termos e /privacidade (e o rodapé delas).
 * O que devolve: nome, documento (CNPJ/CPF), e-mail de contato (encarregado de dados) e endereço.
 *
 * Os valores vêm das variáveis LEGAL_* (ver `.env.example`). No site oficial elas são obrigatórias
 * (o app nem inicia sem elas — `env-schema.ts`); em desenvolvimento e nos previews aparecem textos
 * de exemplo entre colchetes, para ninguém confundir com dados reais.
 */
import "server-only";

import { env } from "@/lib/env";

export type CompanyInfo = {
  name: string;
  document: string;
  contactEmail: string;
  address: string | null;
};

export function getCompanyInfo(): CompanyInfo {
  return {
    name: env.LEGAL_COMPANY_NAME ?? "[Razão social da empresa]",
    document: env.LEGAL_COMPANY_DOCUMENT ?? "[CNPJ]",
    contactEmail: env.LEGAL_CONTACT_EMAIL ?? "privacidade@exemplo.com.br",
    address: env.LEGAL_ADDRESS ?? null,
  };
}
