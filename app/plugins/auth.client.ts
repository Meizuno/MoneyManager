export default defineNuxtPlugin(async () => {
  // The server plugin already populated the user during SSR; only fetch
  // on the client when it didn't (e.g. a fresh anonymous load), avoiding
  // a redundant /api/auth/me round-trip on every authenticated page load.
  const { user, refresh } = useAuth();
  if (!user.value) await refresh();
});
