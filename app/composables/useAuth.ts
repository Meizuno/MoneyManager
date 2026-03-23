type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
};

export const useAuth = () => {
  const user = useState<AuthUser | null>("auth_user", () => null);
  const loggedIn = computed(() => Boolean(user.value));

  // Fetch current user from the server (also triggers token refresh via server middleware)
  const refresh = async (): Promise<boolean> => {
    try {
      const data = await $fetch<{ user: AuthUser }>("/api/auth/me");
      user.value = data.user;
      return true;
    } catch {
      user.value = null;
      return false;
    }
  };

  const logout = async () => {
    try {
      await $fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    user.value = null;
    await navigateTo("/login");
  };

  // All API calls use cookies automatically (httpOnly, same-origin).
  // If the server returns 401 (both tokens expired), redirect to login.
  const apiFetch = async <T>(url: string, options: Parameters<typeof $fetch>[1] = {}) => {
    try {
      return await $fetch<T>(url, options);
    } catch (error: any) {
      const status = error?.statusCode ?? error?.status ?? 0;
      if (status === 401) {
        user.value = null;
        await navigateTo("/login");
      }
      throw error;
    }
  };

  return { user, loggedIn, refresh, logout, apiFetch };
};
