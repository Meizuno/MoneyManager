type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
};

export const useAuth = () => {
  const user = useState<AuthUser | null>("auth_user", () => null);
  const loggedIn = computed(() => Boolean(user.value));

  // Request-aware $fetch. During SSR it forwards the incoming request's
  // headers — crucially the auth cookies — to internal /api calls, so
  // data fetched for the first (server) render is authenticated and gets
  // serialized into the payload (no client-side refetch). On the client
  // it is just the global $fetch. This is what makes Nuxt's BFF / SSR
  // data-fetching actually work here; plain $fetch dropped the cookies on
  // the server and every page hydrated empty.
  const requestFetch = useRequestFetch();

  // Fetch current user from the server. /api/auth/me runs authenticate(),
  // which refreshes a stale access token from the refresh-token cookie —
  // so this also rehydrates the session on app open after the JWT expired.
  const refresh = async (): Promise<boolean> => {
    try {
      const data = await requestFetch<{ user: AuthUser }>("/api/auth/me");
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

  // All API calls go through the request-aware fetch (cookies forwarded
  // on SSR, automatic same-origin cookies on the client). A 401 means
  // both tokens are gone — drop the user and bounce to login.
  const apiFetch = async <T>(url: string, options: Parameters<typeof $fetch>[1] = {}) => {
    try {
      return await requestFetch<T>(url, options);
    }
    catch (error: unknown) {
      // $fetch errors carry `statusCode` / `status` depending on path;
      // narrow defensively without losing the rethrow.
      const e = error as { statusCode?: number; status?: number } | null;
      const status = e?.statusCode ?? e?.status ?? 0;
      if (status === 401) {
        user.value = null;
        await navigateTo("/login");
      }
      throw error;
    }
  };

  return { user, loggedIn, refresh, logout, apiFetch };
};
