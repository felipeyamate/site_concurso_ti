/**
 * env-schema.ts — Define QUAIS variáveis de ambiente o app espera e em que formato.
 *
 * Quem chama: `src/lib/env.ts` (que valida o `process.env` real) e os testes
 * (`env-schema.test.ts`, que validam cenários de exemplo).
 * O que devolve: a função `parseEnv`, que recebe um dicionário de variáveis e devolve
 * o objeto validado — ou lança um erro listando o que está faltando/errado.
 *
 * Por que separado de `env.ts`: aqui não há efeitos colaterais (não lê `process.env`
 * sozinho), então dá para testar com valores inventados.
 */
import { z } from "zod";

// Variáveis vazias no .env (ex.: GOOGLE_CLIENT_ID="") chegam como "" (texto vazio).
// Tratamos "" como "não informado", para os campos opcionais funcionarem como esperado.
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = () => z.preprocess(emptyToUndefined, z.string().optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Banco de dados
    DATABASE_URL: z
      .string({ error: "DATABASE_URL é obrigatória (string de conexão do PostgreSQL)." })
      .regex(/^postgres(ql)?:\/\//, "DATABASE_URL deve começar com postgresql://"),

    // Autenticação
    BETTER_AUTH_SECRET: z
      .string({ error: "BETTER_AUTH_SECRET é obrigatória. Gere com: openssl rand -base64 32" })
      .min(32, "BETTER_AUTH_SECRET precisa ter pelo menos 32 caracteres."),
    BETTER_AUTH_URL: z.url({
      error: "BETTER_AUTH_URL deve ser o endereço do site, ex.: http://localhost:3000",
    }),

    // Login com Google (opcional: as duas juntas ou nenhuma)
    GOOGLE_CLIENT_ID: optionalString(),
    GOOGLE_CLIENT_SECRET: optionalString(),

    // E-mails
    RESEND_API_KEY: optionalString(),
    EMAIL_FROM: z.preprocess(
      emptyToUndefined,
      z.string().default("Concurso TI <onboarding@resend.dev>"),
    ),

    // Vídeo de exemplo do provedor de desenvolvimento (aulas com provedor DEV).
    DEV_SAMPLE_VIDEO_URL: z.preprocess(
      emptyToUndefined,
      z
        .url({ error: "DEV_SAMPLE_VIDEO_URL deve ser um endereço de vídeo (https://...)." })
        .default("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"),
    ),

    // Preenchida automaticamente pela Vercel: "production" só no site oficial
    // ("preview" nos deploys de teste). Vazia na sua máquina.
    VERCEL_ENV: z.preprocess(emptyToUndefined, z.enum(["development", "preview", "production"]).optional()),
  })
  // Regra que envolve mais de um campo (como um `@model_validator` do pydantic):
  // não faz sentido ter só o ID do Google sem o segredo, ou vice-versa.
  .superRefine((values, ctx) => {
    const hasId = Boolean(values.GOOGLE_CLIENT_ID);
    const hasSecret = Boolean(values.GOOGLE_CLIENT_SECRET);
    if (hasId !== hasSecret) {
      ctx.addIssue({
        code: "custom",
        path: [hasId ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID"],
        message: "Para o login com Google, preencha GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET juntos.",
      });
    }

    // Em produção, com o Resend ligado, o remetente precisa ser de um domínio NOSSO verificado.
    // O remetente de teste "@resend.dev" só entrega para o dono da conta do Resend: os alunos
    // nunca receberiam os e-mails (e o erro só apareceria no log). Melhor barrar já no deploy.
    const usesResendSandbox = values.EMAIL_FROM.toLowerCase().includes("@resend.dev");
    if (values.NODE_ENV === "production" && values.RESEND_API_KEY && usesResendSandbox) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_FROM"],
        message:
          "Em produção, EMAIL_FROM precisa usar um domínio verificado no Resend (ex.: Concurso TI <contato@seudominio.com.br>).",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Valida um conjunto de variáveis de ambiente.
 *
 * Passos:
 *  1. Roda o schema do zod (equivale a `Settings(**os.environ)` no pydantic).
 *  2. Se der certo, devolve os valores já convertidos/tipados.
 *  3. Se der errado, lança UM erro com TODOS os problemas, em português, para
 *     você corrigir tudo de uma vez no `.env.local` (ou na Vercel).
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Variáveis de ambiente inválidas. Confira o arquivo .env.local (modelo em .env.example):\n${problems}`,
    );
  }
  return result.data;
}
