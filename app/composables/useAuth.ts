
type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
};

type RefreshResponse = {
  accessToken: string;
  user: AuthUser;
};

export const useAuth = () => {
  const accessToken = useState<string | null>("auth_access_token", () => null);
  const user = useState<AuthUser | null>("auth_user", () => null);
  const refreshing = useState<boolean>("auth_refreshing", () => false);

  const loggedIn = computed(() => Boolean(user.value));

  const refresh = async () => {
    if (refreshing.value) return Boolean(accessToken.value);
    refreshing.value = true;
    try {
      const result = await $fetch<RefreshResponse>("/api/auth/refresh", {
        method: "POST",
      });
      accessToken.value = result.accessToken;
      user.value = result.user;
      return true;
    } catch {
      accessToken.value = null;
      user.value = null;
      return false;
    } finally {
      refreshing.value = false;
    }
  };

  const logout = async () => {
    try {
      await $fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout errors.
    }
    accessToken.value = null;
    user.value = null;
  };

  const apiFetch = async <T>(url: string, options: Parameters<typeof $fetch>[1] = {}) => {
    const headers = new Headers(options?.headers as HeadersInit | undefined);
    if (accessToken.value) {
      headers.set("authorization", `Bearer ${accessToken.value}`);
    }
    try {
      return await $fetch<T>(url, { ...options, headers });
    } catch (error: any) {
      const status = error?.statusCode ?? error?.status ?? 0;
      if (status === 401) {
        const ok = await refresh();
        if (ok && accessToken.value) {
          headers.set("authorization", `Bearer ${accessToken.value}`);
          return await $fetch<T>(url, { ...options, headers });
        }
      }
      throw error;
    }
  };

  return {
    accessToken,
    user,
    loggedIn,
    refresh,
    logout,
    apiFetch,
  };
};
