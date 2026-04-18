import { getCookie, getHeader } from "h3";

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith("/api/") || path.startsWith("/api/auth/") || path.startsWith("/api/mcp")) return;

  const token = getHeader(event, "authorization")?.slice(7) ?? getCookie(event, "mm_access") ?? "";
  const user = await verifyAccessToken(token);
  if (user) {
    event.context.authUser = user;
    event.context.accessToken = token;
    return;
  }

  const refreshToken = getCookie(event, "mm_refresh");
  if (!refreshToken) return;

  try {
    const config = useRuntimeConfig();
    const result = await $fetch<{ access_token: string; refresh_token: string }>(
      `${config.authServiceUrl}/refresh`,
      { method: "POST", body: { refresh_token: refreshToken } },
    );
    setAuthCookies(event, result.access_token, result.refresh_token);
    const refreshed = await verifyAccessToken(result.access_token);
    if (refreshed) {
      event.context.authUser = refreshed;
      event.context.accessToken = result.access_token;
    }
  } catch {
    clearAuthCookies(event);
  }
});
