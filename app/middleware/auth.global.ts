export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return; // user state is populated client-side only
  if (to.path === "/login") return;
  const { user } = useAuth();
  if (!user.value) {
    return navigateTo("/login");
  }
});
