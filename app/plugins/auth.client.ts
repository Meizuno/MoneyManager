export default defineNuxtPlugin(async () => {
  const { initGuest, isGuest } = useGuest();
  initGuest();
  if (isGuest.value) return;

  const { refresh } = useAuth();
  await refresh();
});
