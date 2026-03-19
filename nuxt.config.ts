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

  modules: ["@nuxt/ui", "nuxt-auth-utils", "@nuxtjs/i18n"],
  css: ["~/assets/css/main.css"],

  i18n: {
    defaultLocale: "uk",
    locales: [
      { code: "uk", language: "uk-UA", name: "Українська", flag: "i-circle-flags-ua", file: "uk.json" },
      { code: "en", language: "en-US", name: "English", flag: "i-circle-flags-gb", file: "en.json" },
    ],
    langDir: "locales",
    strategy: "no_prefix",
  },
  runtimeConfig: {
    auth: {
      jwtSecret: "",
      accessTokenTTL: "900",
      refreshTokenTTL: "2592000",
      allowedEmails: "",
    },
  },
});
