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
    // The one auth-service address. Used both for server-to-server calls
    // (validate / refresh / me) and as the target of the /auth-proxy
    // reverse proxy that fronts the browser OAuth flow — so it can be an
    // internal Docker address in production, e.g.
    // NUXT_AUTH_SERVICE_URL=http://authentication:8000, with no public
    // auth URL needed.
    authServiceUrl: "http://localhost:8080",
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
