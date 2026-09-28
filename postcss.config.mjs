/**
 * postcss.config.mjs — Liga o Tailwind CSS ao processo de build do CSS.
 * Quem usa: o Next.js, ao processar `src/app/globals.css`. Não precisa ser alterado.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
