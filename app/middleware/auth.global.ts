export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return;
  if (to.path === "/login") return;
  const { isGuest } = useGuest();
  if (isGuest.value) return;
  const { user } = useAuth();
  if (!user.value) return navigateTo("/login");
});
