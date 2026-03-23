export default defineNuxtRouteMiddleware((to) => {
  if (to.path === "/login") return;
  const { user } = useAuth();
  if (!user.value) {
    return navigateTo("/login");
  }
});
