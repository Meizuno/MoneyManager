// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  app: {
    head: {
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      ],
      meta: [
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "apple-mobile-web-app-title", content: "Money Manager" },
        { name: "theme-color", content: "#0e7490" },
      ],
    },
  },

  modules: ["@nuxt/ui", "@nuxtjs/i18n", "@nuxt/eslint"],
  css: ["~/assets/css/main.css"],

  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", language: "en-US", name: "English", file: "en.json" },
    ],
    langDir: "locales",
    strategy: "no_prefix",
  },
  runtimeConfig: {
    authServiceUrl: "http://localhost:8080",
    mcpApiKey: "",
    // Gate the category-MUTATING MCP tools (add/update/remove expense &
    // income categories). Off by default: the chat model only needs to
    // read categories and reference their ids on transactions — letting
    // it create/rename/delete categories was guarded by a prompt-only
    // "confirm with the user" note the server never enforced. Set
    // NUXT_MCP_ALLOW_CATEGORY_MUTATIONS=true to expose them. Boolean
    // default → Nuxt coerces the env string to a real boolean.
    mcpAllowCategoryMutations: false,
  },

  // Auto-import server-side use-case functions from server/services
  // alongside the default server/utils. Keeps "services/" expressive
  // as the layer name while preserving the same auto-import ergonomics
  // every other server module enjoys.
  nitro: {
    imports: {
      dirs: ["server/services"],
    },
  },
});
