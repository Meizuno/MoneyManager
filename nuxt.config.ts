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

  modules: ["@nuxt/ui", "nuxt-auth-utils"],
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    auth: {
      jwtSecret: "",
      accessTokenTTL: "900",
      refreshTokenTTL: "2592000",
      allowedEmails: "",
    },
  },
});
