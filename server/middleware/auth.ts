import { getCookie, getRequestURL } from "h3";
import { getAuthUser, clearAuthCookies, setAuthCookies } from "../utils/auth";
import { getAccessTokenTTL, getRefreshTokenTTL, signAccessToken } from "../utils/jwt";
import { getPrisma } from "../utils/db";

// Paths that handle their own auth – skip auto-refresh for these
const SKIP = ["/api/auth/google", "/api/auth/refresh", "/api/auth/logout", "/api/mcp"];

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith("/api/") || SKIP.some((p) => path.startsWith(p))) return;

  // Valid access token — attach user to context and continue
  const user = await getAuthUser(event);
  if (user) {
    event.context.authUser = user;
    return;
  }

  // Access token missing/expired — try refresh token
  const refreshToken = getCookie(event, "mm_refresh");
  if (!refreshToken) return;

  const prisma = getPrisma();
  const refresh = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!refresh || refresh.expires_at <= new Date()) {
    clearAuthCookies(event);
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: refresh.user_id },
    select: { id: true, email: true, name: true, picture: true },
  });
  if (!dbUser) {
    clearAuthCookies(event);
    return;
  }

  const accessTTL = getAccessTokenTTL();
  const refreshTTL = getRefreshTokenTTL();
  const newAccess = await signAccessToken(dbUser, accessTTL);
  const newRefresh = crypto.randomUUID();

  await prisma.refreshToken.update({
    where: { id: refresh.id },
    data: { token: newRefresh, expires_at: new Date(Date.now() + refreshTTL * 1000) },
  });

  setAuthCookies(event, newAccess, newRefresh, accessTTL, refreshTTL);
  event.context.authUser = { id: dbUser.id, email: dbUser.email, name: dbUser.name, picture: dbUser.picture };
});
