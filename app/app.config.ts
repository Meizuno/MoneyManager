// Nuxt UI's palette: the brand's cyan (the logo, the theme-color meta)
// rather than the library's default green, which read as "income" next to
// the amounts.
export default defineAppConfig({
  ui: {
    colors: {
      primary: "cyan",
      neutral: "slate",
    },
    // A confirmation is one of the app's own cards (`.panel` in main.css):
    // the same radius, hairline border and soft shadow, the title in the
    // display face. The icon comes as a tinted circle — see useNotice.
    toast: {
      slots: {
        root: "rounded-2xl ring-0 border border-default bg-default p-3.5 gap-3 shadow-lg shadow-slate-900/8 dark:shadow-black/40",
        title: "font-display text-[15px] font-semibold text-highlighted",
        description: "text-sm text-muted",
        close: "p-0 text-dimmed",
      },
    },
  },
});
