import { getCookie, getHeader, setCookie } from "h3";
import type { H3Event } from "h3";
import { createError } from "h3";
import { verifyAccessToken } from "./jwt";

type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
};

export const getAccessTokenFromRequest = (event: H3Event) => {
  // Bearer header first (for MCP/API clients that can't use cookies)
  const header = getHeader(event, "authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return getCookie(event, "mm_access") ?? null;
};

export const getAuthUser = async (event: H3Event): Promise<AuthUser | null> => {
  const token = getAccessTokenFromRequest(event);
  if (!token) return null;
  try {
    const payload = await verifyAccessToken(token);
    return {
      id: payload.sub as string,
      email: (payload.email as string | undefined) ?? null,
      name: (payload.name as string | undefined) ?? null,
      picture: (payload.picture as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
};

export const requireAuthUser = async (event: H3Event): Promise<AuthUser> => {
  // Prefer context set by the auto-refresh middleware
  if (event.context.authUser) return event.context.authUser as AuthUser;

  const user = await getAuthUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  return user;
};

export const setAuthCookies = (
  event: H3Event,
  accessToken: string,
  refreshToken: string,
  accessTTL: number,
  refreshTTL: number,
) => {
  const isSecure = (process.env.NODE_ENV ?? "development") === "production";
  setCookie(event, "mm_access", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: accessTTL,
  });
  setCookie(event, "mm_refresh", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: refreshTTL,
  });
};

export const clearAuthCookies = (event: H3Event) => {
  setCookie(event, "mm_access", "", { path: "/", maxAge: 0 });
  setCookie(event, "mm_refresh", "", { path: "/", maxAge: 0 });
};
