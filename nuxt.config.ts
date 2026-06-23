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
    // Server-to-server base (token validate / refresh / me). In production
    // this can be an internal Docker network address, e.g.
    // NUXT_AUTH_SERVICE_URL=http://authentication:8000 — those calls never
    // leave the host.
    authServiceUrl: "http://localhost:8080",
    // Browser-facing base for the OAuth login flow. The browser runs the
    // whole Google dance on the auth server's own public domain (it owns
    // its /google/callback and registered redirect_uri), so this must be a
    // public URL, e.g. NUXT_AUTH_PUBLIC_URL=https://auth.example.com. Empty
    // → falls back to authServiceUrl (dev / single-URL setups).
    authPublicUrl: "",
    // Parent domain for the shared auth cookies (NUXT_COOKIE_DOMAIN, e.g.
    // `.meizuno.com`) so one sign-in spans every *.meizuno.com app. Empty in
    // dev → host-only cookies on localhost.
    cookieDomain: "",
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
