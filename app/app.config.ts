// Nuxt UI's palette: the brand's cyan (the logo, the theme-color meta)
// rather than the library's default green, which read as "income" next to
// the amounts.
export default defineAppConfig({
  ui: {
    colors: {
      primary: "cyan",
      neutral: "slate",
    },
  },
});
