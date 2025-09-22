import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  integrations: [
    tailwind({
      applyBaseStyles: true, // Abilita stili base Tailwind
      configFile: "./tailwind.config.mjs",
    }),
  ],
  output: "server",
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
  site: "https://sistema-tirocini-astro.vercel.app",

  // Configurazione per GitHub Pages (alternativa)
  // output: 'static',
  // site: 'https://evolvewd.github.io',
  // base: '/sistema-tirocini-astro',

  vite: {
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  },
});
