/**
 * db.ts — Acesso direto ao banco nos testes E2E (só para preparar a cena, nunca para conferir regra
 * que a tela deveria mostrar).
 *
 * Quem chama: os testes de `tests/e2e/` — ex.: promover uma conta a admin, criar um produto à venda,
 * "envelhecer" um aceite dos termos.
 * Usa o `pg` puro (o mesmo driver do app) com a DATABASE_URL (carregada do `.env.local` pelo
 * `playwright.config.ts`; no CI, vem das variáveis do job).
 * Paralelo em Python: `psycopg.connect(url).execute(sql, params)`.
 */
import { Client } from "pg";

/** Roda um comando SQL com parâmetros ($1, $2...) e devolve as linhas. */
export async function sql<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<Row[]> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida (configure o .env.local).");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await client.query<Row>(text, params);
    return result.rows;
  } finally {
    await client.end();
  }
}

/** Muda o perfil de uma conta (ex.: "ADMIN") — o mesmo que `npm run user:set-role`. */
export async function setRole(email: string, role: "STUDENT" | "TEACHER" | "ADMIN"): Promise<void> {
  await sql(`UPDATE users SET role = $1 WHERE email = $2`, [role, email]);
}

/**
 * Cria um produto ATIVO de R$ 197,00 que libera o Curso Base do seed (`npm run db:seed`).
 * Devolve o endereço (slug) do produto.
 */
export async function createProductForBaseCourse(slug: string, title: string): Promise<string> {
  await sql(
    `INSERT INTO products (id, slug, title, description, price_cents, access_days, max_installments, is_active, created_at, updated_at)
     VALUES ($1, $1, $2, '', 19700, 365, 12, true, now(), now())`,
    [slug, title],
  );
  await sql(`INSERT INTO product_courses (product_id, course_id) SELECT $1, id FROM courses WHERE slug = 'informatica-e-ti-do-zero'`, [slug]);
  return slug;
}
